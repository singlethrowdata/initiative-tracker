import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { sql } from '@/lib/db'

export async function GET() {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = session.user.email.toLowerCase()

  const data = await sql`
    SELECT pn.*,
      COALESCE(
        json_agg(
          json_build_object(
            'id', pc.id, 'note_id', pc.note_id,
            'content', pc.content, 'created_at', pc.created_at
          ) ORDER BY pc.created_at
        ) FILTER (WHERE pc.id IS NOT NULL),
        '[]'::json
      ) AS personal_comments
    FROM personal_notes pn
    LEFT JOIN personal_comments pc ON pc.note_id = pn.id
    WHERE pn.user_email = ${email}
    GROUP BY pn.id
    ORDER BY pn.updated_at DESC
  `
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = session.user.email.toLowerCase()
  const body = await req.json()

  const [data] = await sql`
    INSERT INTO personal_notes (user_email, title, content)
    VALUES (${email}, ${body.title}, ${body.content ?? ''})
    RETURNING *
  `
  return NextResponse.json(data, { status: 201 })
}
