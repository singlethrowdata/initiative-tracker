import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { sql, sqlUpdate } from '@/lib/db'
import { isAdmin } from '@/lib/team'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Params) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const email = session.user.email.toLowerCase()
  const body = await req.json()

  const isResolveOnly = Object.keys(body).every(k => k === 'is_resolved')
  if (!isResolveOnly) {
    const [existing] = await sql`SELECT user_email FROM community_posts WHERE id = ${id}`
    const adminFlag = await isAdmin(email)
    if (!adminFlag && existing?.user_email !== email) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const data = await sqlUpdate('community_posts', { ...body, updated_at: new Date().toISOString() }, id)
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const email = session.user.email.toLowerCase()

  const [existing] = await sql`SELECT user_email FROM community_posts WHERE id = ${id}`
  const adminFlag = await isAdmin(email)
  if (!adminFlag && existing?.user_email !== email) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await sql`DELETE FROM community_posts WHERE id = ${id}`
  return NextResponse.json({ success: true })
}
