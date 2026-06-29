import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { sql } from '@/lib/db'
import { isAdmin } from '@/lib/team'

type Params = { params: Promise<{ id: string; postId: string }> }

// Detach a community idea from this initiative. Admin or whoever linked it.
export async function DELETE(_req: Request, { params }: Params) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, postId } = await params
  const email = session.user.email.toLowerCase()

  const [existing] = await sql`
    SELECT linked_by FROM initiative_community_links
    WHERE initiative_id = ${id} AND post_id = ${postId}
  `
  if (!existing) return NextResponse.json({ success: true })

  const adminFlag = await isAdmin(email)
  if (!adminFlag && existing.linked_by !== email) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await sql`
    DELETE FROM initiative_community_links
    WHERE initiative_id = ${id} AND post_id = ${postId}
  `

  // Detaching returns the idea to the open board — but only if no other
  // initiative still has it absorbed.
  const [stillLinked] = await sql`
    SELECT 1 FROM initiative_community_links WHERE post_id = ${postId} LIMIT 1
  `
  if (!stillLinked) {
    await sql`UPDATE community_posts SET is_resolved = false, updated_at = NOW() WHERE id = ${postId}`
  }

  return NextResponse.json({ success: true })
}
