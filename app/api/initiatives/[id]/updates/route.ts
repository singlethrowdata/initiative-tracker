import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { sql } from '@/lib/db'
import { getMemberName, getTeamMap } from '@/lib/team'
import { processAndNotifyMentions } from '@/lib/mentions'
import { sendWaitingOnEmail } from '@/lib/email'

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

  const [data] = await sql`
    INSERT INTO updates (
      initiative_id, user_email, user_name, description, assigned_to,
      links, waiting_on, target_date, participants, completed
    ) VALUES (
      ${id}, ${email}, ${userName},
      ${body.description ?? ''}, ${body.assigned_to ?? ''},
      ${body.links ?? ''}, ${body.waiting_on ?? ''},
      ${body.target_date ?? null}, ${body.participants ?? ''}, false
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
    const teamMap = await getTeamMap()
    const waitingOnEmail = Object.entries(teamMap).find(([, name]) => name === body.waiting_on)?.[0]
    if (waitingOnEmail) {
      const [initiative] = await sql`SELECT task_name FROM initiatives WHERE id = ${id}`
      if (initiative) {
        await sendWaitingOnEmail(
          waitingOnEmail, body.waiting_on,
          initiative.task_name as string, userName, body.description
        )
      }
    }
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

  return NextResponse.json(data, { status: 201 })
}
