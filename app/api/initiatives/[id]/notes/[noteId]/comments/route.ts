import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { sql } from '@/lib/db'
import { getMemberName } from '@/lib/team'

type Params = { params: Promise<{ id: string; noteId: string }> }

export async function POST(req: Request, { params }: Params) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { noteId } = await params
  const email = session.user.email.toLowerCase()
  const body = await req.json()
  const userName = await getMemberName(email)

  const [data] = await sql`
    INSERT INTO note_comments (note_id, user_email, user_name, content)
    VALUES (${noteId}, ${email}, ${userName}, ${body.content})
    RETURNING *
  `
  return NextResponse.json(data, { status: 201 })
}
