import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { sql } from '@/lib/db'
import { BLOCKER_CATEGORIES } from '@/lib/di-scheduling'

type Params = { params: Promise<{ id: string }> }

// Blocker tagging is independent of status — it explains why the CURRENT open stage is
// taking long, without forcing a fake status change (see lexicon.md "Blocker Reason").
export async function PATCH(req: Request, { params }: Params) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const category = body.blocker_category ?? null

  if (category !== null && !BLOCKER_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: 'Invalid blocker_category' }, { status: 400 })
  }

  const [data] = await sql`
    UPDATE di_status_history
    SET blocker_category = ${category}, blocker_note = ${body.blocker_note ?? null}
    WHERE di_initiative_id = ${id} AND exited_at IS NULL
    RETURNING *
  `
  if (!data) return NextResponse.json({ error: 'No open stage found for this initiative' }, { status: 404 })

  return NextResponse.json(data)
}
