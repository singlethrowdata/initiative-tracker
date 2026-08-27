import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { sql } from '@/lib/db'
import { isDiTeamMember } from '@/lib/di-config'
import { QUEUED_STATUSES } from '@/lib/di-scheduling'

export async function PATCH(req: Request) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const email = session.user.email.toLowerCase()
  if (!(await isDiTeamMember(email))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const ids: unknown = body?.ids
  if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string')) {
    return NextResponse.json({ error: 'ids must be an array of initiative ids' }, { status: 400 })
  }
  const orderedIds = ids as string[]

  const queuedRows = await sql`SELECT id FROM di_initiatives WHERE status = ANY(${QUEUED_STATUSES})`
  const queuedIds = new Set((queuedRows as { id: string }[]).map(r => r.id))
  const submittedIds = new Set(orderedIds)

  const exactMatch = submittedIds.size === orderedIds.length
    && submittedIds.size === queuedIds.size
    && orderedIds.every(id => queuedIds.has(id))
  if (!exactMatch) {
    return NextResponse.json({ error: 'ids must exactly match the current queued set' }, { status: 400 })
  }

  await Promise.all(
    orderedIds.map((id, index) =>
      sql`UPDATE di_initiatives SET queue_position = ${index}, updated_at = NOW() WHERE id = ${id}`
    )
  )

  return NextResponse.json({ ok: true })
}
