import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { sql } from '@/lib/db'
import { getMemberName } from '@/lib/team'
import { processAndNotifyMentions } from '@/lib/mentions'

export async function GET() {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = session.user.email.toLowerCase()

  const posts = await sql`
    SELECT cp.*,
      COALESCE(
        json_agg(DISTINCT jsonb_build_object(
          'id', cc.id, 'post_id', cc.post_id, 'user_email', cc.user_email,
          'user_name', cc.user_name, 'content', cc.content, 'created_at', cc.created_at
        )) FILTER (WHERE cc.id IS NOT NULL),
        '[]'::json
      ) AS community_comments,
      COALESCE(
        json_agg(DISTINCT jsonb_build_object('user_email', pl.user_email))
        FILTER (WHERE pl.user_email IS NOT NULL),
        '[]'::json
      ) AS post_likes
    FROM community_posts cp
    LEFT JOIN community_comments cc ON cc.post_id = cp.id
    LEFT JOIN post_likes pl ON pl.post_id = cp.id
    GROUP BY cp.id
    ORDER BY cp.created_at DESC
  `

  const enriched = posts.map((post: Record<string, unknown>) => ({
    ...post,
    likes: (post.post_likes as { user_email: string }[]).length,
    liked_by_user: (post.post_likes as { user_email: string }[]).some(l => l.user_email === email),
  }))

  return NextResponse.json(enriched)
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = session.user.email.toLowerCase()
  const body = await req.json()
  const userName = await getMemberName(email)

  const [data] = await sql`
    INSERT INTO community_posts (user_email, user_name, title, content)
    VALUES (${email}, ${userName}, ${body.title}, ${body.content})
    RETURNING *
  `

  await processAndNotifyMentions(
    [body.title, body.content].filter(Boolean).join(' '),
    body.title,
    'community post',
    userName,
    email
  )

  return NextResponse.json({ ...data, likes: 0, liked_by_user: false }, { status: 201 })
}
