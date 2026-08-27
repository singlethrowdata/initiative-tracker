import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { sql } from '@/lib/db'
import { getMemberName } from '@/lib/team'
import { isDiTeamMember } from '@/lib/di-config'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const updates = await sql`
    SELECT * FROM di_updates WHERE di_initiative_id = ${id} ORDER BY created_at DESC
  `
  return NextResponse.json(updates)
}

export async function POST(req: Request, { params }: Params) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const email = session.user.email.toLowerCase()
  if (!(await isDiTeamMember(email))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  if (!content) return NextResponse.json({ error: 'content is required' }, { status: 400 })

  const userName = await getMemberName(email)
  const [created] = await sql`
    INSERT INTO di_updates (di_initiative_id, user_email, user_name, content)
    VALUES (${id}, ${email}, ${userName}, ${content})
    RETURNING *
  `

  return NextResponse.json(created, { status: 201 })
}
