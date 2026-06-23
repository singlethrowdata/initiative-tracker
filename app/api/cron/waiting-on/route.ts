import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { sendWaitingOnReminderEmail, sendBlockedMilestoneReminderEmail } from '@/lib/email'
import { getTeamMap } from '@/lib/team'

// Vercel cron: weekly — send reminders for every unique waiting-on person across open milestones
export async function GET(req: Request) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch all active initiatives that have at least one open milestone with waiting_on set
  const initiatives = await sql`
    SELECT i.id, i.task_name, i.created_by, i.created_by_name,
           i.waiting_on_set_at, i.last_waiting_on_reminder,
      COALESCE(
        json_agg(json_build_object(
          'id', u.id, 'waiting_on', u.waiting_on,
          'description', u.description, 'assigned_to', u.assigned_to,
          'target_date', u.target_date, 'posted_by', u.user_name
        )) FILTER (WHERE u.id IS NOT NULL AND u.completed = false AND u.waiting_on IS NOT NULL AND u.waiting_on != ''),
        '[]'::json
      ) AS open_waiting
    FROM initiatives i
    JOIN updates u ON u.initiative_id = i.id
    WHERE i.is_archived = false
      AND u.completed = false
      AND u.waiting_on IS NOT NULL
      AND u.waiting_on != ''
    GROUP BY i.id
  `

  const teamMap = await getTeamMap()
  const nameToEmail = Object.fromEntries(Object.entries(teamMap).map(([e, n]) => [n, e]))
  const now = Date.now()
  let sent = 0

  for (const initiative of initiatives) {
    const lastReminder = initiative.last_waiting_on_reminder
      ? new Date(initiative.last_waiting_on_reminder as string).getTime()
      : 0
    const daysSinceReminder = Math.floor((now - lastReminder) / 86_400_000)

    // Rate limit: one batch of reminders per initiative per 7 days
    if (daysSinceReminder < 7) continue

    const openWaiting = initiative.open_waiting as Array<{
      waiting_on: string; description: string; target_date: string | null; posted_by: string | null
    }>
    const requestedByName = teamMap[initiative.created_by as string] ?? (initiative.created_by_name as string) ?? ''

    // Only remind once a milestone is overdue (past its target date), and never
    // email the person who set the waiting-on on their own milestone — they know.
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const byPerson = new Map<string, { actions: string[]; daysOverdue: number }>()
    for (const u of openWaiting) {
      if (!u.waiting_on) continue
      if (u.posted_by && u.waiting_on === u.posted_by) continue
      if (!u.target_date) continue
      const due = new Date(u.target_date as string)
      if (Number.isNaN(due.getTime())) continue
      const daysOverdue = Math.floor((startOfToday.getTime() - due.getTime()) / 86_400_000)
      if (daysOverdue < 1) continue
      const entry = byPerson.get(u.waiting_on) ?? { actions: [], daysOverdue: 0 }
      entry.actions.push(u.description)
      entry.daysOverdue = Math.max(entry.daysOverdue, daysOverdue)
      byPerson.set(u.waiting_on, entry)
    }

    // Nothing overdue for this initiative — skip without touching the rate-limit stamp
    if (byPerson.size === 0) continue

    // Send one email per unique waiting-on person
    for (const [personName, { actions, daysOverdue }] of byPerson) {
      const personEmail = nameToEmail[personName]
      if (!personEmail) continue
      await sendWaitingOnReminderEmail(
        personEmail, personName,
        initiative.task_name as string,
        daysOverdue, requestedByName, actions
      )
      sent++
    }

    await sql`
      UPDATE initiatives SET last_waiting_on_reminder = ${new Date().toISOString()}
      WHERE id = ${initiative.id}
    `
  }

  // Blocked milestones — notify the assigned person regardless of waiting_on
  const blockedMilestones = await sql`
    SELECT u.id, u.description, u.assigned_to, u.blocked_reason, u.created_at,
           i.task_name, i.last_waiting_on_reminder
    FROM updates u
    JOIN initiatives i ON i.id = u.initiative_id
    WHERE i.is_archived = false
      AND u.completed = false
      AND u.blocked = true
      AND u.assigned_to IS NOT NULL
      AND u.assigned_to != ''
  `

  for (const u of blockedMilestones) {
    const lastReminder = u.last_waiting_on_reminder
      ? new Date(u.last_waiting_on_reminder as string).getTime()
      : 0
    const daysSinceReminder = Math.floor((now - lastReminder) / 86_400_000)
    if (daysSinceReminder < 7) continue

    const createdAt = u.created_at ? new Date(u.created_at as string).getTime() : now
    const daysPending = Math.max(1, Math.floor((now - createdAt) / 86_400_000))
    if (daysPending < 2) continue

    const assignedEmail = nameToEmail[u.assigned_to as string]
    if (!assignedEmail) continue

    await sendBlockedMilestoneReminderEmail(
      assignedEmail, u.assigned_to as string,
      u.task_name as string,
      u.description as string,
      (u.blocked_reason as string) || 'No reason specified',
      daysPending
    )
    sent++
  }

  return NextResponse.json({ sent })
}
