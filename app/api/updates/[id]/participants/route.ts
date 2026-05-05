import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { sql } from '@/lib/db'
import { isAdmin } from '@/lib/team'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Params) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const email = session.user.email.toLowerCase()
  const body = await req.json()

  const [existing] = await sql`SELECT user_email FROM updates WHERE id = ${id}`
  const adminFlag = await isAdmin(email)
  if (!adminFlag && existing?.user_email !== email) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [data] = await sql`
    UPDATE updates SET participants = ${body.participants} WHERE id = ${id} RETURNING *
  `
  return NextResponse.json(data)
}
