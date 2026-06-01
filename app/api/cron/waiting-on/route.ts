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
          'description', u.description, 'assigned_to', u.assigned_to
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

    const setAt = initiative.waiting_on_set_at
      ? new Date(initiative.waiting_on_set_at as string).getTime()
      : now
    const daysPending = Math.max(1, Math.floor((now - setAt) / 86_400_000))

    // Don't spam on brand-new waiting-ons
    if (daysPending < 2) continue

    const openWaiting = initiative.open_waiting as Array<{ waiting_on: string; description: string }>
    const requestedByName = teamMap[initiative.created_by as string] ?? (initiative.created_by_name as string) ?? ''

    // Group open milestones by waiting_on person
    const byPerson = new Map<string, string[]>()
    for (const u of openWaiting) {
      if (!u.waiting_on) continue
      if (!byPerson.has(u.waiting_on)) byPerson.set(u.waiting_on, [])
      byPerson.get(u.waiting_on)!.push(u.description)
    }

    // Send one email per unique waiting-on person
    for (const [personName, actions] of byPerson) {
      const personEmail = nameToEmail[personName]
      if (!personEmail) continue
      await sendWaitingOnReminderEmail(
        personEmail, personName,
        initiative.task_name as string,
        daysPending, requestedByName, actions
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
