import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { sql } from '@/lib/db'
import { getMemberName, getTeamByName } from '@/lib/team'
import { processAndNotifyMentions } from '@/lib/mentions'
import { sendAddedToInitiativeEmail } from '@/lib/email'

export async function GET() {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await sql`
    SELECT i.*,
      COALESCE(
        json_agg(
          json_build_object(
            'id', u.id,
            'waiting_on', u.waiting_on,
            'completed', u.completed,
            'target_date', u.target_date,
            'assigned_to', u.assigned_to,
            'description', u.description,
            'created_at', u.created_at,
            'user_name', u.user_name
          )
        ) FILTER (WHERE u.id IS NOT NULL),
        '[]'::json
      ) AS updates
    FROM initiatives i
    LEFT JOIN updates u ON u.initiative_id = i.id
    WHERE i.is_archived = false
    GROUP BY i.id
    ORDER BY i.updated_at DESC
  `
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = session.user.email.toLowerCase()
  const body = await req.json()
  const createdByName = await getMemberName(email)

  const [data] = await sql`
    INSERT INTO initiatives (
      task_name, type, priority, status, description, notes,
      participants, links, department, start_date, anticipated_end_date,
      waiting_on, created_by, created_by_name, is_archived
    ) VALUES (
      ${body.task_name},
      ${body.type ?? 'Project'},
      ${body.priority ?? 'Medium'},
      ${body.status ?? 'In Progress'},
      ${body.description ?? ''},
      ${body.notes ?? ''},
      ${body.participants ?? ''},
      ${body.links ?? ''},
      ${body.department ?? ''},
      ${body.start_date ?? null},
      ${body.anticipated_end_date ?? null},
      ${body.waiting_on ?? ''},
      ${email},
      ${createdByName},
      false
    )
    RETURNING *
  `

  await processAndNotifyMentions(
    [body.description, body.notes].filter(Boolean).join(' '),
    body.task_name,
    'initiative',
    createdByName,
    email
  )

  // Notify each participant (except the creator) that they've been added
  const participantNames = String(body.participants ?? '')
    .split(',').map((s: string) => s.trim()).filter(Boolean)
  if (participantNames.length) {
    const nameToEmail = await getTeamByName()
    const notified = new Set<string>()
    for (const name of participantNames) {
      const memberEmail = nameToEmail[name]
      if (!memberEmail || memberEmail.toLowerCase() === email || notified.has(memberEmail.toLowerCase())) continue
      notified.add(memberEmail.toLowerCase())
      await sendAddedToInitiativeEmail(memberEmail, name, body.task_name, createdByName, body.description)
    }
  }

  return NextResponse.json(data, { status: 201 })
}
