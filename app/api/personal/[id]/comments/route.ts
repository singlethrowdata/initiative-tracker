import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { sql } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const email = session.user.email.toLowerCase()

  const [note] = await sql`SELECT user_email FROM personal_notes WHERE id = ${id}`
  if (note?.user_email !== email) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const data = await sql`
    SELECT * FROM personal_comments WHERE note_id = ${id} ORDER BY created_at ASC
  `
  return NextResponse.json(data)
}

export async function POST(req: Request, { params }: Params) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const email = session.user.email.toLowerCase()
  const body = await req.json()

  const [note] = await sql`SELECT user_email FROM personal_notes WHERE id = ${id}`
  if (note?.user_email !== email) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [data] = await sql`
    INSERT INTO personal_comments (note_id, content) VALUES (${id}, ${body.content}) RETURNING *
  `
  return NextResponse.json(data, { status: 201 })
}
