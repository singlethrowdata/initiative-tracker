import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { postToChat } from '@/lib/di-alerts'

// Vercel cron: daily — alert on D+I Roadmap stages aging past stage_alert_days that
// nobody has explained yet. Goes quiet the moment a Blocker Reason is tagged (see
// docs/adr and lexicon.md "Blocker Reason") — this is a "nobody's looked at this" signal,
// not a standing nag once someone already knows.
export async function GET(req: Request) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [cfg] = await sql`SELECT value FROM di_config WHERE key = 'stage_alert_days'`
  const alertDays = Number(cfg?.value ?? 10)
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const alertCutoff = new Date(Date.now() - alertDays * 86_400_000).toISOString()

  const rows = await sql`
    SELECT h.id AS history_id, i.project_name, i.owner, h.status, h.entered_at
    FROM di_status_history h
    JOIN di_initiatives i ON i.id = h.di_initiative_id
    WHERE h.exited_at IS NULL
      AND h.blocker_category IS NULL
      AND h.entered_at <= ${alertCutoff}
      AND (h.last_aging_alert_sent IS NULL OR h.last_aging_alert_sent <= ${sevenDaysAgo})
  `

  let sent = 0
  for (const r of rows as { history_id: string; project_name: string; owner: string; status: string; entered_at: string }[]) {
    const days = Math.round((Date.now() - new Date(r.entered_at).getTime()) / 86_400_000)
    await postToChat(
      `⏰ D+I Roadmap: "${r.project_name}" (${r.owner || 'Unassigned'}) has been in ${r.status} for ${days}d with no reason tagged.`
    )
    await sql`UPDATE di_status_history SET last_aging_alert_sent = NOW() WHERE id = ${r.history_id}`
    sent++
  }

  return NextResponse.json({ sent })
}
