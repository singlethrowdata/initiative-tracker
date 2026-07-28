import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { sql, sqlUpdate } from '@/lib/db'
import { isAdmin, getMemberName } from '@/lib/team'
import { IN_FLIGHT_STATUSES, calcRiceScore, recalcQueueDates, isOverdue, DiInitiativeRow } from '@/lib/di-scheduling'
import { mirrorStatusToTracker } from '@/lib/di-tracker-mirror'
import { wipCapReached } from '@/lib/di-wip'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Target dates depend on where this row sits in its owner's whole queue chain, so
  // recompute against every row (same as the list endpoint), not just this one — see
  // recalcQueueDates in lib/di-scheduling.ts.
  const [allRows, history] = await Promise.all([
    sql`SELECT * FROM di_initiatives`,
    sql`SELECT * FROM di_status_history WHERE di_initiative_id = ${id} ORDER BY entered_at`,
  ])

  const row = (allRows as unknown as DiInitiativeRow[]).find(r => r.id === id)
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const targets = recalcQueueDates(allRows as unknown as DiInitiativeRow[]).get(id) ?? null
  const deployTarget = targets?.deploy_target ?? null

  return NextResponse.json({
    initiative: {
      ...row,
      ...targets,
      rice_score: calcRiceScore(row),
      overdue: isOverdue(row.status, deployTarget),
    },
    history,
  })
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const email = session.user.email.toLowerCase()
  const body = await req.json()

  const [existing] = await sql`SELECT * FROM di_initiatives WHERE id = ${id}`
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const adminFlag = await isAdmin(email)
  if (!adminFlag && existing.created_by !== email) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const actingName = await getMemberName(email)
  const newStatus: string | undefined = body.status
  const statusChanging = newStatus !== undefined && newStatus !== existing.status
  const extra: Record<string, unknown> = {}

  if (statusChanging) {
    const owner = body.owner ?? existing.owner ?? ''
    if (IN_FLIGHT_STATUSES.includes(newStatus) && (await wipCapReached(owner, id))) {
      return NextResponse.json({ error: `${owner || 'This owner'} is already at their WIP cap.` }, { status: 400 })
    }

    await sql`
      UPDATE di_status_history SET exited_at = NOW()
      WHERE di_initiative_id = ${id} AND exited_at IS NULL
    `
    await sql`
      INSERT INTO di_status_history (di_initiative_id, status, set_by_email, set_by_name)
      VALUES (${id}, ${newStatus}, ${email}, ${actingName})
    `

    if (IN_FLIGHT_STATUSES.includes(newStatus) && !existing.date_start) {
      extra.date_start = new Date().toISOString()
    }
    if (newStatus === 'Done') {
      extra.date_completed = new Date().toISOString()
    }

    if (existing.tracker_initiative_id) {
      await mirrorStatusToTracker({
        trackerInitiativeId: existing.tracker_initiative_id,
        newStatus,
        actingEmail: email,
        actingName,
      })
    }
  }

  const data = await sqlUpdate('di_initiatives', { ...body, ...extra, updated_at: new Date().toISOString() }, id)
  if (!data) return NextResponse.json({ error: 'Update failed' }, { status: 500 })

  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = session.user.email.toLowerCase()
  const adminFlag = await isAdmin(email)
  if (!adminFlag) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  await sql`DELETE FROM di_initiatives WHERE id = ${id}`
  return NextResponse.json({ success: true })
}
