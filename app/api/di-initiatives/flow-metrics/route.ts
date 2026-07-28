import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { sql } from '@/lib/db'

interface HistoryEntry {
  di_initiative_id: string
  status: string
  entered_at: string
}

const WEEKS_WINDOW = 12

function weekStart(d: Date): string {
  const c = new Date(d)
  c.setHours(0, 0, 0, 0)
  c.setDate(c.getDate() - c.getDay()) // back to Sunday
  return c.toISOString().slice(0, 10)
}

// Lead Time, Cycle Time, and weekly Throughput — computed from di_status_history for
// every initiative that has reached Done. See docs/adr and lexicon.md for why these
// weren't tracked before (only one overall Date Start/Date Completed existed in the old
// Sheet); the full per-transition log this app keeps makes them a read, not new work.
export async function GET() {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await sql`
    SELECT h.di_initiative_id, h.status, h.entered_at
    FROM di_status_history h
    JOIN di_initiatives i ON i.id = h.di_initiative_id
    WHERE i.status = 'Done'
    ORDER BY h.di_initiative_id, h.entered_at
  `
  const history = rows as unknown as HistoryEntry[]

  const byInitiative = new Map<string, HistoryEntry[]>()
  for (const h of history) {
    if (!byInitiative.has(h.di_initiative_id)) byInitiative.set(h.di_initiative_id, [])
    byInitiative.get(h.di_initiative_id)!.push(h)
  }

  const leadDays: number[] = []
  const cycleDays: number[] = []
  const throughputByWeek = new Map<string, number>()

  const cutoff = new Date(Date.now() - WEEKS_WINDOW * 7 * 86_400_000)

  for (const [, entries] of byInitiative) {
    const doneRow = entries.find(e => e.status === 'Done')
    if (!doneRow) continue
    const doneAt = new Date(doneRow.entered_at)

    const firstAt = new Date(entries[0].entered_at)
    leadDays.push((doneAt.getTime() - firstAt.getTime()) / 86_400_000)

    const designRow = entries.find(e => e.status === 'Design')
    if (designRow) {
      cycleDays.push((doneAt.getTime() - new Date(designRow.entered_at).getTime()) / 86_400_000)
    }

    if (doneAt >= cutoff) {
      const wk = weekStart(doneAt)
      throughputByWeek.set(wk, (throughputByWeek.get(wk) ?? 0) + 1)
    }
  }

  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null)

  return NextResponse.json({
    avgLeadDays: avg(leadDays),
    avgCycleDays: avg(cycleDays),
    doneCount: byInitiative.size,
    throughputByWeek: Array.from(throughputByWeek.entries())
      .map(([week, count]) => ({ week, count }))
      .sort((a, b) => a.week.localeCompare(b.week)),
  })
}
