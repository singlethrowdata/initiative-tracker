import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { sql, sqlUpdate } from '@/lib/db'
import { isAdmin, getMemberName } from '@/lib/team'
import { processAndNotifyMentions } from '@/lib/mentions'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const [initiative, updates, notes] = await Promise.all([
    sql`SELECT * FROM initiatives WHERE id = ${id}`.then(r => r[0] ?? null),
    sql`
      SELECT u.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', uc.id, 'update_id', uc.update_id, 'user_email', uc.user_email,
              'user_name', uc.user_name, 'content', uc.content, 'created_at', uc.created_at
            ) ORDER BY uc.created_at
          ) FILTER (WHERE uc.id IS NOT NULL),
          '[]'::json
        ) AS update_comments
      FROM updates u
      LEFT JOIN update_comments uc ON uc.update_id = u.id
      WHERE u.initiative_id = ${id}
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `,
    sql`
      SELECT n.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', nc.id, 'note_id', nc.note_id, 'user_email', nc.user_email,
              'user_name', nc.user_name, 'content', nc.content, 'created_at', nc.created_at
            ) ORDER BY nc.created_at
          ) FILTER (WHERE nc.id IS NOT NULL),
          '[]'::json
        ) AS note_comments
      FROM initiative_notes n
      LEFT JOIN note_comments nc ON nc.note_id = n.id
      WHERE n.initiative_id = ${id}
      GROUP BY n.id
      ORDER BY n.created_at DESC
    `,
  ])

  if (!initiative) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ initiative, updates, notes })
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const email = session.user.email.toLowerCase()
  const body = await req.json()

  const [existing] = await sql`
    SELECT created_by, task_name FROM initiatives WHERE id = ${id}
  `
  const adminFlag = await isAdmin(email)
  if (!adminFlag && existing?.created_by !== email) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const data = await sqlUpdate('initiatives', { ...body, updated_at: new Date().toISOString() }, id)
  if (!data) return NextResponse.json({ error: 'Update failed' }, { status: 500 })

  const authorName = await getMemberName(email)
  const mentionText = [body.description, body.notes].filter(Boolean).join(' ')
  if (mentionText) {
    await processAndNotifyMentions(mentionText, existing?.task_name ?? '', 'initiative', authorName, email)
  }

  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const email = session.user.email.toLowerCase()
  const adminFlag = await isAdmin(email)
  if (!adminFlag) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await sql`DELETE FROM initiatives WHERE id = ${id}`
  return NextResponse.json({ success: true })
}
