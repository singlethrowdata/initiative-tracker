import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { sql, sqlUpdate } from '@/lib/db'
import { isAdmin, getMemberName, getTeamByName } from '@/lib/team'
import { processAndNotifyMentions } from '@/lib/mentions'
import { sendAssignedToMilestoneEmail } from '@/lib/email'
import { mirrorWaitingOnToRoadmap } from '@/lib/di-tracker-mirror'

type Params = { params: Promise<{ id: string }> }

async function syncWaitingOn(initiativeId: string) {
  const rows = await sql`
    SELECT waiting_on FROM updates
    WHERE initiative_id = ${initiativeId}
      AND completed = false
      AND waiting_on IS NOT NULL
      AND waiting_on != ''
    LIMIT 1
  `
  const mostRecent = (rows[0]?.waiting_on ?? '') as string
  await sql`
    UPDATE initiatives SET waiting_on = ${mostRecent}, updated_at = ${new Date().toISOString()}
    WHERE id = ${initiativeId}
  `
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const email = session.user.email.toLowerCase()
  const body = await req.json()

  // Due dates are mandatory — block any edit that would clear/invalidate it
  if ('target_date' in body) {
    const td = typeof body.target_date === 'string' ? body.target_date.slice(0, 10) : ''
    if (!/^\d{4}-\d{2}-\d{2}$/.test(td)) {
      return NextResponse.json({ error: 'A target date is required — it cannot be cleared.' }, { status: 400 })
    }
  }

  const [existing] = await sql`
    SELECT user_email, initiative_id, assigned_to, blocked_reason FROM updates WHERE id = ${id}
  `
  const adminFlag = await isAdmin(email)
  if (!adminFlag && existing?.user_email !== email) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const data = await sqlUpdate('updates', body, id)
  if (!data) return NextResponse.json({ error: 'Update failed' }, { status: 500 })

  if ('waiting_on' in body && existing?.initiative_id) {
    await syncWaitingOn(existing.initiative_id as string)
  }

  // Mirror Sync: a "waiting on" or a new block on this milestone becomes the linked
  // D+I Roadmap item's Blocker Reason, if this initiative is a Linked Initiative.
  if (existing?.initiative_id) {
    const waitingOnText = body.waiting_on || (body.blocked ? (body.blocked_reason ?? existing.blocked_reason) : '')
    if (waitingOnText) {
      await mirrorWaitingOnToRoadmap({ trackerInitiativeId: existing.initiative_id as string, waitingOn: waitingOnText as string })
    }
  }

  const authorName = await getMemberName(email)

  if (existing?.initiative_id) {
    const [initiative] = await sql`SELECT task_name FROM initiatives WHERE id = ${existing.initiative_id}`
    const initiativeName = (initiative?.task_name ?? '') as string

    if (body.description) {
      await processAndNotifyMentions(body.description, initiativeName, 'update', authorName, email)
    }

    if (
      'assigned_to' in body &&
      body.assigned_to &&
      body.assigned_to !== existing.assigned_to
    ) {
      const nameMap = await getTeamByName()
      const assignedEmail = nameMap[body.assigned_to]
      if (assignedEmail && assignedEmail !== email) {
        const description = (data as { description?: string }).description ?? ''
        await sendAssignedToMilestoneEmail(assignedEmail, body.assigned_to, initiativeName, authorName, description)
      }
    }
  }

  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const email = session.user.email.toLowerCase()

  const [existing] = await sql`
    SELECT user_email, initiative_id FROM updates WHERE id = ${id}
  `
  const adminFlag = await isAdmin(email)
  if (!adminFlag && existing?.user_email !== email) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await sql`DELETE FROM updates WHERE id = ${id}`

  if (existing?.initiative_id) {
    await syncWaitingOn(existing.initiative_id as string)
  }

  return NextResponse.json({ success: true })
}
