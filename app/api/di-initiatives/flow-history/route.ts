import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { sql } from '@/lib/db'
import { STATUS_VALUES } from '@/lib/di-scheduling'

// Cumulative Flow Diagram data: for each day in the window, how many initiatives were
// sitting in each status. di_status_history already logs every entered_at/exited_at, so
// this is a reconstruction from data we already had — not new tracking.
export async function GET(req: Request) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const days = Math.min(Math.max(Number(searchParams.get('days')) || 60, 1), 365)

  const rows = await sql`SELECT status, entered_at, exited_at FROM di_status_history`
  const history = rows as unknown as { status: string; entered_at: string; exited_at: string | null }[]

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const out: Array<Record<string, string | number>> = []

  for (let i = days - 1; i >= 0; i--) {
    const dayStart = new Date(today.getTime() - i * 86_400_000)
    const dayEnd = new Date(dayStart.getTime() + 86_400_000)

    const counts: Record<string, number> = {}
    for (const s of STATUS_VALUES) counts[s] = 0

    for (const h of history) {
      const entered = new Date(h.entered_at)
      const exited = h.exited_at ? new Date(h.exited_at) : null
      const wasPresent = entered < dayEnd && (exited === null || exited > dayStart)
      if (wasPresent && counts[h.status] !== undefined) counts[h.status]++
    }

    out.push({ date: dayStart.toISOString().slice(0, 10), ...counts })
  }

  return NextResponse.json(out)
}
