import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { sql } from '@/lib/db'
import { getMemberName } from '@/lib/team'
import { processAndNotifyMentions } from '@/lib/mentions'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const data = await sql`
    SELECT * FROM initiative_notes WHERE initiative_id = ${id} ORDER BY created_at DESC
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
    INSERT INTO initiative_notes (initiative_id, user_email, user_name, content)
    VALUES (${id}, ${email}, ${userName}, ${body.content})
    RETURNING *
  `

  const [initiative] = await sql`SELECT task_name FROM initiatives WHERE id = ${id}`
  await processAndNotifyMentions(
    body.content, (initiative?.task_name ?? '') as string, 'note', userName, email
  )

  return NextResponse.json(data, { status: 201 })
}
