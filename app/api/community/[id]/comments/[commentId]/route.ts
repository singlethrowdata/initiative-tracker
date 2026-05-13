import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { sql } from '@/lib/db'
import { isAdmin } from '@/lib/team'

type Params = { params: Promise<{ id: string; commentId: string }> }

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { commentId } = await params
  const email = session.user.email.toLowerCase()

  const [existing] = await sql`SELECT user_email FROM community_comments WHERE id = ${commentId}`
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const adminFlag = await isAdmin(email)
  if (!adminFlag && existing.user_email !== email) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await sql`DELETE FROM community_comments WHERE id = ${commentId}`
  return NextResponse.json({ success: true })
}
