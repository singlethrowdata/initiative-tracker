import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { sendWaitingOnReminderEmail } from '@/lib/email'
import { getTeamMap } from '@/lib/team'

// Vercel cron: weekly — send reminders for initiatives with unresolved waiting-on
export async function GET(req: Request) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const initiatives = await sql`
    SELECT i.*,
      COALESCE(
        json_agg(json_build_object(
          'id', u.id, 'waiting_on', u.waiting_on,
          'completed', u.completed, 'description', u.description, 'assigned_to', u.assigned_to
        )) FILTER (WHERE u.id IS NOT NULL),
        '[]'::json
      ) AS updates
    FROM initiatives i
    LEFT JOIN updates u ON u.initiative_id = i.id
    WHERE i.is_archived = false
      AND i.waiting_on IS NOT NULL
      AND i.waiting_on != ''
    GROUP BY i.id
  `

  const teamMap = await getTeamMap()
  const now = Date.now()
  let sent = 0

  for (const initiative of initiatives) {
    const waitingOnName = initiative.waiting_on as string
    const setAt = initiative.waiting_on_set_at
      ? new Date(initiative.waiting_on_set_at as string).getTime()
      : now
    const daysPending = Math.floor((now - setAt) / 86_400_000)

    const lastReminder = initiative.last_waiting_on_reminder
      ? new Date(initiative.last_waiting_on_reminder as string).getTime()
      : 0
    const daysSinceReminder = Math.floor((now - lastReminder) / 86_400_000)

    if (daysPending < 2 || daysSinceReminder < 7) continue

    const waitingOnEmail = Object.entries(teamMap).find(([, name]) => name === waitingOnName)?.[0]
    if (!waitingOnEmail) continue

    const updates = initiative.updates as Array<{ waiting_on: string; completed: boolean; description: string }>
    const openActions = updates
      .filter(u => !u.completed && u.waiting_on === waitingOnName)
      .map(u => u.description)
      .filter(Boolean)

    const requestedByName = teamMap[initiative.created_by as string] ?? (initiative.created_by_name as string) ?? ''

    await sendWaitingOnReminderEmail(
      waitingOnEmail, waitingOnName, initiative.task_name as string,
      daysPending, requestedByName, openActions
    )

    await sql`
      UPDATE initiatives SET last_waiting_on_reminder = ${new Date().toISOString()}
      WHERE id = ${initiative.id}
    `
    sent++
  }

  return NextResponse.json({ sent })
}
