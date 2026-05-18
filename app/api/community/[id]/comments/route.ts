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
    SELECT * FROM community_comments WHERE post_id = ${id} ORDER BY created_at ASC
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
    INSERT INTO community_comments (post_id, user_email, user_name, content, is_concern)
    VALUES (${id}, ${email}, ${userName}, ${body.content}, ${!!body.is_concern})
    RETURNING *
  `

  const [post] = await sql`SELECT title FROM community_posts WHERE id = ${id}`
  await processAndNotifyMentions(
    body.content, (post?.title ?? '') as string, 'community comment', userName, email
  )

  return NextResponse.json(data, { status: 201 })
}
