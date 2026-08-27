import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { sql, sqlUpdate } from '@/lib/db'
import { getMemberName } from '@/lib/team'
import { getDiConfig, isDiTeamMember } from '@/lib/di-config'
import {
  DiInitiativeRow,
  PIPELINE_STAGES,
  calcRiceScore,
  computeCapacityView,
  CapacityView,
} from '@/lib/di-scheduling'
import { DiInitiative, DiStatusHistoryEntry, DiUpdate } from '@/types'

type Params = { params: Promise<{ id: string }> }

// A status carries an open di_status_history row for as long as the initiative sits
// in it. Backlog/In Queue/Done never get one (ADR-0003 domain rule).
const HISTORY_BEARING_STATUSES: Record<string, true> = Object.fromEntries(
  [...PIPELINE_STAGES, 'Blocked', 'Paused'].map(s => [s, true])
)

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

/** Closes whatever di_status_history row is currently open for this initiative
 * (a no-op if the previous status never had one — Backlog/In Queue/Done), then opens
 * a fresh one for `nextStatus` unless it's Backlog/In Queue/Done. Blocker fields are
 * only ever attached to a Blocked or Paused entry. */
async function applyStatusTransition(
  id: string,
  nextStatus: string,
  blockerCategory: string | null,
  blockerNote: string | null,
  setByEmail: string,
  setByName: string,
): Promise<void> {
  await sql`
    UPDATE di_status_history SET exited_at = NOW()
    WHERE di_initiative_id = ${id} AND exited_at IS NULL
  `

  if (!HISTORY_BEARING_STATUSES[nextStatus]) return

  const isBlockerStatus = nextStatus === 'Blocked' || nextStatus === 'Paused'
  await sql`
    INSERT INTO di_status_history (
      di_initiative_id, status, entered_at, blocker_category, blocker_note, set_by_email, set_by_name
    ) VALUES (
      ${id}, ${nextStatus}, NOW(),
      ${isBlockerStatus ? blockerCategory : null}, ${isBlockerStatus ? blockerNote : null},
      ${setByEmail}, ${setByName}
    )
  `
}

export async function GET(_req: Request, { params }: Params) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const [config, rawRows, rawHistory, updates] = await Promise.all([
    getDiConfig(),
    sql`
      SELECT di.*, init.task_name AS tracker_initiative_name
      FROM di_initiatives di
      LEFT JOIN initiatives init ON init.id = di.tracker_initiative_id
    ` as unknown as Promise<RawInitiativeRow[]>,
    sql`SELECT * FROM di_status_history ORDER BY entered_at ASC` as unknown as Promise<RawHistoryRow[]>,
    sql`SELECT * FROM di_updates WHERE di_initiative_id = ${id} ORDER BY created_at DESC` as unknown as Promise<DiUpdate[]>,
  ])

  const row = rawRows.find(r => r.id === id)
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const historyByInitiative = groupHistoryByInitiative(rawHistory)
  const capacityView = computeCapacityView(rawRows, historyByInitiative, config.capacityBudgetWeeks, config.wipCap)
  const initiative = toDiInitiative(row, capacityView, historyByInitiative.get(id) ?? [])

  return NextResponse.json({ initiative, updates })
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const email = session.user.email.toLowerCase()
  if (!(await isDiTeamMember(email))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await req.json()

  const [existing] = await sql`SELECT status FROM di_initiatives WHERE id = ${id}`
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // blocker_category/blocker_note live on di_status_history, never on di_initiatives —
  // pulled out here so sqlUpdate never sees them (its ALLOWED allowlist would drop
  // them anyway, but this keeps the intent explicit).
  const { blocker_category, blocker_note, ...rest } = body
  const fields: Record<string, unknown> = { ...rest, updated_at: new Date().toISOString() }

  if (typeof body.status === 'string' && body.status !== existing.status) {
    const nextStatus: string = body.status
    if (nextStatus === 'Blocked' && (!blocker_category || !blocker_note)) {
      return NextResponse.json(
        { error: 'blocker_category and blocker_note are required when moving to Blocked' },
        { status: 400 }
      )
    }

    const setByName = await getMemberName(email)
    await applyStatusTransition(id, nextStatus, blocker_category ?? null, blocker_note ?? null, email, setByName)

    if (nextStatus === 'Done') {
      fields.date_completed = new Date().toISOString()
      fields.queue_position = null
    }
  }

  const data = await sqlUpdate('di_initiatives', fields, id)
  if (!data) return NextResponse.json({ error: 'Update failed' }, { status: 500 })

  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const email = session.user.email.toLowerCase()
  if (!(await isDiTeamMember(email))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  // FK ON DELETE CASCADE on di_status_history and di_updates handles the rest.
  await sql`DELETE FROM di_initiatives WHERE id = ${id}`

  return new NextResponse(null, { status: 204 })
}
