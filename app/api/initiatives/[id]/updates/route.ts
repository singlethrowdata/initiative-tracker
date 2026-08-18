import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { sql } from '@/lib/db'
import { getMemberName, getTeamByName } from '@/lib/team'
import { processAndNotifyMentions } from '@/lib/mentions'
import { sendAssignedToMilestoneEmail } from '@/lib/email'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const data = await sql`
    SELECT u.*,
      COALESCE(
        json_agg(
          json_build_object(
            'id', uc.id, 'update_id', uc.update_id, 'user_email', uc.user_email,
            'user_name', uc.user_name, 'content', uc.content, 'created_at', uc.created_at
          ) ORDER BY uc.created_at
        ) FILTER (WHERE uc.id IS NOT NULL),
        '[]'::json
      ) AS update_comments
    FROM updates u
    LEFT JOIN update_comments uc ON uc.update_id = u.id
    WHERE u.initiative_id = ${id}
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `
  return NextResponse.json(data)
}

export async function POST(req: Request, { params }: Params) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const email = session.user.email.toLowerCase()
  const body = await req.json()
  const userName = await getMemberName(email)

  const targetDate = typeof body.target_date === 'string' ? body.target_date.slice(0, 10) : ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    return NextResponse.json({ error: 'A target date is required for every milestone.' }, { status: 400 })
  }

  const [data] = await sql`
    INSERT INTO updates (
      initiative_id, user_email, user_name, description, assigned_to,
      links, waiting_on, target_date, participants, completed
    ) VALUES (
      ${id}, ${email}, ${userName},
      ${body.description ?? ''}, ${body.assigned_to ?? ''},
      ${body.links ?? ''}, ${body.waiting_on ?? ''},
      ${targetDate}, ${body.participants ?? ''}, false
    )
    RETURNING *
  `

  if (body.waiting_on) {
    await sql`
      UPDATE initiatives SET
        waiting_on = ${body.waiting_on},
        waiting_on_set_at = ${new Date().toISOString()},
        updated_at = ${new Date().toISOString()}
      WHERE id = ${id}
    `
    // No immediate "waiting on" email — whoever was just named already knows.
    // The weekly cron emails them only once the milestone is overdue, and
    // never when they set the waiting-on on their own milestone.

    // No mirror sync — the D+I Roadmap feature was removed.
  } else {
    await sql`UPDATE initiatives SET updated_at = ${new Date().toISOString()} WHERE id = ${id}`
  }

  const [initiative] = await sql`SELECT task_name FROM initiatives WHERE id = ${id}`
  await processAndNotifyMentions(
    [body.description, body.links].filter(Boolean).join(' '),
    (initiative?.task_name ?? '') as string,
    'update',
    userName,
    email
  )

  if (body.assigned_to) {
    const nameMap = await getTeamByName()
    const assignedEmail = nameMap[body.assigned_to]
    if (assignedEmail && assignedEmail !== email) {
      await sendAssignedToMilestoneEmail(
        assignedEmail, body.assigned_to,
        (initiative?.task_name ?? '') as string,
        userName, body.description
      )
    }
  }

  return NextResponse.json(data, { status: 201 })
}
