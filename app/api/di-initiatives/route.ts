import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { sql } from '@/lib/db'
import { getMemberName } from '@/lib/team'
import { ACTIVE_STATUSES, IN_FLIGHT_STATUSES, calcRiceScore, recalcQueueDates, isOverdue, DiInitiativeRow } from '@/lib/di-scheduling'
import { wipCapReached } from '@/lib/di-wip'

function enrich(rows: DiInitiativeRow[]) {
  const targets = recalcQueueDates(rows)
  return rows.map(row => {
    const t = targets.get(row.id) ?? null
    const deployTarget = t?.deploy_target ?? null
    return {
      ...row,
      ...t,
      rice_score: calcRiceScore(row),
      overdue: isOverdue(row.status, deployTarget),
    }
  })
}

export async function GET() {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await sql`
    SELECT i.*,
      COALESCE(
        json_agg(
          json_build_object(
            'id', h.id, 'status', h.status, 'entered_at', h.entered_at, 'exited_at', h.exited_at,
            'blocker_category', h.blocker_category, 'blocker_note', h.blocker_note
          ) ORDER BY h.entered_at
        ) FILTER (WHERE h.id IS NOT NULL),
        '[]'::json
      ) AS history
    FROM di_initiatives i
    LEFT JOIN di_status_history h ON h.di_initiative_id = i.id
    GROUP BY i.id
    ORDER BY i.updated_at DESC
  `

  return NextResponse.json(enrich(rows as unknown as DiInitiativeRow[]))
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = session.user.email.toLowerCase()
  const body = await req.json()

  if (!body.project_name) {
    return NextResponse.json({ error: 'project_name is required' }, { status: 400 })
  }

  const status = body.status ?? 'Backlog'
  const owner = body.owner ?? ''
  if (IN_FLIGHT_STATUSES.includes(status) && (await wipCapReached(owner))) {
    return NextResponse.json({ error: `${owner || 'This owner'} is already at their WIP cap.` }, { status: 400 })
  }

  const createdByName = await getMemberName(email)
  const enteringActive = ACTIVE_STATUSES.includes(status)

  const [data] = await sql`
    INSERT INTO di_initiatives (
      priority, tier, type, project_name, architect, owner, status,
      status_note, description, outcome, link, pace_id, accelo_id,
      rice_r, rice_i, rice_c, design_wks, build_wks, qa_wks, approval_wks, deploy_wks,
      tracker_initiative_id, date_start, created_by, created_by_name
    ) VALUES (
      ${body.priority ?? 'Medium'},
      ${body.tier ?? '3 - Explore'},
      ${body.type ?? 'Other'},
      ${body.project_name},
      ${body.architect ?? ''},
      ${body.owner ?? ''},
      ${status},
      ${body.status_note ?? ''},
      ${body.description ?? ''},
      ${body.outcome ?? ''},
      ${body.link ?? ''},
      ${body.pace_id ?? ''},
      ${body.accelo_id ?? ''},
      ${body.rice_r ?? null},
      ${body.rice_i ?? null},
      ${body.rice_c ?? null},
      ${body.design_wks ?? 0},
      ${body.build_wks ?? 0},
      ${body.qa_wks ?? 0},
      ${body.approval_wks ?? 0},
      ${body.deploy_wks ?? 0},
      ${body.tracker_initiative_id ?? null},
      ${enteringActive ? new Date().toISOString() : null},
      ${email},
      ${createdByName}
    )
    RETURNING *
  `

  await sql`
    INSERT INTO di_status_history (di_initiative_id, status, set_by_email, set_by_name)
    VALUES (${data.id}, ${status}, ${email}, ${createdByName})
  `

  return NextResponse.json(data, { status: 201 })
}
