import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { sql } from '@/lib/db'
import { getMemberName } from '@/lib/team'
import { getDiConfig, isDiTeamMember } from '@/lib/di-config'
import {
  QUEUED_STATUSES,
  DiInitiativeRow,
  calcRiceScore,
  computeCapacityView,
  insertionIndexByRice,
  CapacityView,
} from '@/lib/di-scheduling'
import { DiInitiative, DiStatusHistoryEntry } from '@/types'

// Raw shapes as they come back from Postgres — NUMERIC columns arrive as strings,
// which is exactly what DiInitiativeRow (from lib/di-scheduling.ts) already expects.
type RawInitiativeRow = DiInitiativeRow & {
  queue_position: number | null
  project_name: string
  tier: string
  type: string
  architect: string
  owner: string
  status: string
  status_note: string
  size_preset: string
  date_completed: string | null
  description: string
  outcome: string
  link: string
  pace_id: string
  accelo_id: string
  priority: string
  tracker_initiative_id: string | null
  tracker_initiative_name: string | null
  created_by: string
  created_by_name: string
  updated_at: string
}

type RawHistoryRow = {
  id: string
  di_initiative_id: string
  status: string
  entered_at: string
  exited_at: string | null
  blocker_category: string | null
  blocker_note: string | null
  set_by_email: string
  set_by_name: string
}

function groupHistoryByInitiative(rows: RawHistoryRow[]): Map<string, RawHistoryRow[]> {
  const byInitiative = new Map<string, RawHistoryRow[]>()
  for (const row of rows) {
    const list = byInitiative.get(row.di_initiative_id)
    if (list) list.push(row)
    else byInitiative.set(row.di_initiative_id, [row])
  }
  return byInitiative
}

function toDiStatusHistoryEntry(row: RawHistoryRow): DiStatusHistoryEntry {
  return {
    id: row.id,
    status: row.status,
    entered_at: row.entered_at,
    exited_at: row.exited_at,
    blocker_category: row.blocker_category,
    blocker_note: row.blocker_note,
    set_by_email: row.set_by_email,
    set_by_name: row.set_by_name,
  }
}

function toDiInitiative(row: RawInitiativeRow, capacityView: CapacityView, history: RawHistoryRow[]): DiInitiative {
  const computed = capacityView.perItem.get(row.id)
  return {
    id: row.id,
    queue_position: row.queue_position,
    priority: row.priority,
    tier: row.tier,
    type: row.type,
    project_name: row.project_name,
    architect: row.architect,
    owner: row.owner,
    status: row.status,
    status_note: row.status_note,
    size_preset: row.size_preset,
    date_start: row.date_start,
    date_completed: row.date_completed,
    description: row.description,
    outcome: row.outcome,
    link: row.link,
    pace_id: row.pace_id,
    accelo_id: row.accelo_id,
    rice_r: row.rice_r == null ? null : Number(row.rice_r),
    rice_i: row.rice_i == null ? null : Number(row.rice_i),
    rice_c: row.rice_c == null ? null : Number(row.rice_c),
    design_wks: Number(row.design_wks) || 0,
    build_wks: Number(row.build_wks) || 0,
    qa_wks: Number(row.qa_wks) || 0,
    approval_wks: Number(row.approval_wks) || 0,
    deploy_wks: Number(row.deploy_wks) || 0,
    tracker_initiative_id: row.tracker_initiative_id,
    tracker_initiative_name: row.tracker_initiative_name,
    created_by: row.created_by,
    created_by_name: row.created_by_name,
    created_at: row.created_at,
    updated_at: row.updated_at,
    history: history.map(toDiStatusHistoryEntry),
    in_flight: computed?.in_flight ?? false,
    rice_score: calcRiceScore(row),
    target_date: computed?.target_date ?? null,
    variance_weeks: computed?.variance_weeks ?? null,
    starts_in_weeks: computed?.starts_in_weeks ?? null,
  }
}

export async function GET() {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const email = session.user.email.toLowerCase()

  const [config, rawRows, rawHistory, isDiTeam] = await Promise.all([
    getDiConfig(),
    sql`
      SELECT di.*, init.task_name AS tracker_initiative_name
      FROM di_initiatives di
      LEFT JOIN initiatives init ON init.id = di.tracker_initiative_id
      ORDER BY di.created_at ASC
    ` as unknown as Promise<RawInitiativeRow[]>,
    sql`SELECT * FROM di_status_history ORDER BY entered_at ASC` as unknown as Promise<RawHistoryRow[]>,
    isDiTeamMember(email),
  ])

  const historyByInitiative = groupHistoryByInitiative(rawHistory)
  const capacityView = computeCapacityView(rawRows, historyByInitiative, config.capacityBudgetWeeks, config.wipCap)

  const initiatives = rawRows.map(row => toDiInitiative(row, capacityView, historyByInitiative.get(row.id) ?? []))

  const nextOpeningBySize: Record<string, { startsInWeeks: number; finishesInWeeks: number }> = {}
  for (const [name, preset] of Object.entries(config.sizePresets)) {
    if (name === 'Custom') continue
    nextOpeningBySize[name] = capacityView.nextOpening(preset)
  }

  return NextResponse.json({
    initiatives,
    capacity: {
      currentDrawCount: capacityView.currentDrawCount,
      wipCap: capacityView.wipCap,
      nextOpeningBySize,
    },
    isDiTeam,
  })
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const email = session.user.email.toLowerCase()
  if (!(await isDiTeamMember(email))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const projectName = typeof body.project_name === 'string' ? body.project_name.trim() : ''
  if (!projectName) return NextResponse.json({ error: 'project_name is required' }, { status: 400 })

  const config = await getDiConfig()
  const sizePreset: string = body.size_preset ?? 'Medium'

  const stageWeeks = sizePreset === 'Custom'
    ? {
        design: Number(body.design_wks) || 0,
        build: Number(body.build_wks) || 0,
        qa: Number(body.qa_wks) || 0,
        approval: Number(body.approval_wks) || 0,
        deploy: Number(body.deploy_wks) || 0,
      }
    : config.sizePresets[sizePreset] ?? config.sizePresets['Medium']

  const createdByName = await getMemberName(email)

  const queuedRows = await sql`
    SELECT * FROM di_initiatives WHERE status = ANY(${QUEUED_STATUSES}) ORDER BY queue_position ASC
  ` as unknown as RawInitiativeRow[]

  const newRiceScore = calcRiceScore({
    id: 'new',
    status: 'Backlog',
    date_start: null,
    queue_position: null,
    rice_r: body.rice_r ?? null,
    rice_i: body.rice_i ?? null,
    rice_c: body.rice_c ?? null,
    design_wks: stageWeeks.design,
    build_wks: stageWeeks.build,
    qa_wks: stageWeeks.qa,
    approval_wks: stageWeeks.approval,
    deploy_wks: stageWeeks.deploy,
    created_at: new Date().toISOString(),
  })

  const insertIndex = insertionIndexByRice(queuedRows, newRiceScore)

  // Every existing queued row from insertIndex onward shifts up by one to make room —
  // queue_position is a dense 0-based index within the queued set (same invariant the
  // reorder endpoint maintains), so re-numbering by sorted array position is safe even
  // if a stored position had drifted.
  await Promise.all(
    queuedRows.slice(insertIndex).map((row, i) =>
      sql`UPDATE di_initiatives SET queue_position = ${insertIndex + 1 + i}, updated_at = NOW() WHERE id = ${row.id}`
    )
  )

  const [created] = await sql`
    INSERT INTO di_initiatives (
      queue_position, tier, type, project_name, architect, owner, status, size_preset,
      description, link, pace_id, accelo_id, rice_r, rice_i, rice_c,
      design_wks, build_wks, qa_wks, approval_wks, deploy_wks, priority,
      tracker_initiative_id, created_by, created_by_name
    ) VALUES (
      ${insertIndex}, ${body.tier ?? '3 - Explore'}, ${body.type ?? 'Other'}, ${projectName},
      ${body.architect ?? ''}, ${body.owner ?? ''}, 'Backlog', ${sizePreset},
      ${body.description ?? ''}, ${body.link ?? ''}, ${body.pace_id ?? ''}, ${body.accelo_id ?? ''},
      ${body.rice_r ?? null}, ${body.rice_i ?? null}, ${body.rice_c ?? null},
      ${stageWeeks.design}, ${stageWeeks.build}, ${stageWeeks.qa}, ${stageWeeks.approval}, ${stageWeeks.deploy},
      ${body.priority ?? 'Medium'}, ${body.tracker_initiative_id ?? null}, ${email}, ${createdByName}
    )
    RETURNING *
  `

  return NextResponse.json(created, { status: 201 })
}
