import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { sql } from '@/lib/db'
import { getMemberName } from '@/lib/team'

type Params = { params: Promise<{ id: string }> }

// The D+I Roadmap's notes/updates feed — a lightweight timestamped log per initiative,
// separate from the automatic di_status_history log and from Blocker Reason (which
// explains a delay). This is just "what happened" in plain language. No mandatory
// target_date like the generic Tracker's milestones — this isn't scheduling anything.
export async function GET(_req: Request, { params }: Params) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const rows = await sql`
    SELECT * FROM di_updates WHERE di_initiative_id = ${id} ORDER BY created_at DESC
  `
  return NextResponse.json(rows)
}

export async function POST(req: Request, { params }: Params) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const email = session.user.email.toLowerCase()
  const body = await req.json()

  if (!body.content || !String(body.content).trim()) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 })
  }

  const userName = await getMemberName(email)
  const [data] = await sql`
    INSERT INTO di_updates (di_initiative_id, user_email, user_name, content)
    VALUES (${id}, ${email}, ${userName}, ${body.content})
    RETURNING *
  `
  return NextResponse.json(data, { status: 201 })
}
