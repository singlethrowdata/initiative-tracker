import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { sql } from '@/lib/db'

type Params = { params: Promise<{ id: string; noteId: string; commentId: string }> }

export async function PATCH(req: Request, { params }: Params) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { commentId } = await params
  const email = session.user.email.toLowerCase()
  const { content } = await req.json()

  const [existing] = await sql`SELECT user_email FROM note_comments WHERE id = ${commentId}`
  if (!existing || existing.user_email !== email) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [updated] = await sql`
    UPDATE note_comments SET content = ${content} WHERE id = ${commentId} RETURNING *
  `
  return NextResponse.json(updated)
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { commentId } = await params
  const email = session.user.email.toLowerCase()

  const [existing] = await sql`SELECT user_email FROM note_comments WHERE id = ${commentId}`
  if (!existing || existing.user_email !== email) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await sql`DELETE FROM note_comments WHERE id = ${commentId}`
  return NextResponse.json({ success: true })
}
