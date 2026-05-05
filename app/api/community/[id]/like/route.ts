import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { sql } from '@/lib/db'
import { sendCommunityMilestoneEmail } from '@/lib/email'

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: Request, { params }: Params) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const email = session.user.email.toLowerCase()

  const [existing] = await sql`
    SELECT 1 FROM post_likes WHERE post_id = ${id} AND user_email = ${email}
  `

  if (existing) {
    await sql`DELETE FROM post_likes WHERE post_id = ${id} AND user_email = ${email}`
  } else {
    await sql`INSERT INTO post_likes (post_id, user_email) VALUES (${id}, ${email})`

    const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM post_likes WHERE post_id = ${id}`
    if (count === 10) {
      const [post] = await sql`
        SELECT title, content, user_email, user_name FROM community_posts WHERE id = ${id}
      `
      if (post) {
        await sendCommunityMilestoneEmail(
          post.user_email as string,
          post.user_name as string,
          post.title as string,
          post.content as string
        )
      }
    }
  }

  const [{ count: likeCount }] = await sql`
    SELECT COUNT(*)::int AS count FROM post_likes WHERE post_id = ${id}
  `
  return NextResponse.json({ likes: likeCount, liked: !existing })
}
