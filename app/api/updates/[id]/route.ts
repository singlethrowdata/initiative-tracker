import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { sql, sqlUpdate } from '@/lib/db'
import { isAdmin, getMemberName } from '@/lib/team'
import { processAndNotifyMentions } from '@/lib/mentions'

type Params = { params: Promise<{ id: string }> }

async function syncWaitingOn(initiativeId: string) {
  const rows = await sql`
    SELECT waiting_on FROM updates
    WHERE initiative_id = ${initiativeId}
      AND completed = false
      AND waiting_on IS NOT NULL
      AND waiting_on != ''
    LIMIT 1
  `
  const mostRecent = (rows[0]?.waiting_on ?? '') as string
  await sql`
    UPDATE initiatives SET waiting_on = ${mostRecent}, updated_at = ${new Date().toISOString()}
    WHERE id = ${initiativeId}
  `
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const email = session.user.email.toLowerCase()
  const body = await req.json()

  const [existing] = await sql`
    SELECT user_email, initiative_id FROM updates WHERE id = ${id}
  `
  const adminFlag = await isAdmin(email)
  if (!adminFlag && existing?.user_email !== email) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const data = await sqlUpdate('updates', body, id)
  if (!data) return NextResponse.json({ error: 'Update failed' }, { status: 500 })

  if ('waiting_on' in body && existing?.initiative_id) {
    await syncWaitingOn(existing.initiative_id as string)
  }

  if (body.description && existing?.initiative_id) {
    const authorName = await getMemberName(email)
    const [initiative] = await sql`SELECT task_name FROM initiatives WHERE id = ${existing.initiative_id}`
    await processAndNotifyMentions(
      body.description, (initiative?.task_name ?? '') as string, 'update', authorName, email
    )
  }

  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const email = session.user.email.toLowerCase()

  const [existing] = await sql`
    SELECT user_email, initiative_id FROM updates WHERE id = ${id}
  `
  const adminFlag = await isAdmin(email)
  if (!adminFlag && existing?.user_email !== email) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await sql`DELETE FROM updates WHERE id = ${id}`

  if (existing?.initiative_id) {
    await syncWaitingOn(existing.initiative_id as string)
  }

  return NextResponse.json({ success: true })
}
