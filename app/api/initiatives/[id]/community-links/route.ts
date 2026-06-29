import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { sql } from '@/lib/db'
import { getMemberName } from '@/lib/team'

type Params = { params: Promise<{ id: string }> }

// Attach a community post to this initiative (absorb the idea) and mark the post resolved.
export async function POST(req: Request, { params }: Params) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const email = session.user.email.toLowerCase()
  const body = await req.json()
  const postId = body.post_id

  if (!postId) return NextResponse.json({ error: 'post_id required' }, { status: 400 })

  const name = await getMemberName(email)

  await sql`
    INSERT INTO initiative_community_links (initiative_id, post_id, linked_by, linked_by_name)
    VALUES (${id}, ${postId}, ${email}, ${name})
    ON CONFLICT (initiative_id, post_id) DO NOTHING
  `

  // Absorbing an idea resolves it on the board
  await sql`UPDATE community_posts SET is_resolved = true, updated_at = NOW() WHERE id = ${postId}`

  const [idea] = await sql`
    SELECT l.id, l.initiative_id, l.post_id, l.linked_by_name,
      l.created_at AS linked_at,
      cp.title, cp.content, cp.user_name, cp.user_email,
      cp.created_at, cp.is_resolved,
      (SELECT COUNT(*) FROM community_comments cc WHERE cc.post_id = cp.id)::int AS comment_count,
      (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = cp.id)::int AS likes
    FROM initiative_community_links l
    JOIN community_posts cp ON cp.id = l.post_id
    WHERE l.initiative_id = ${id} AND l.post_id = ${postId}
  `

  return NextResponse.json(idea ?? null, { status: 201 })
}
