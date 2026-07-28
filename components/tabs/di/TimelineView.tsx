'use client'

import { DiInitiative } from '@/types'
import { buildStageSegments } from '@/lib/di-scheduling'

interface Props {
  initiatives: DiInitiative[]
  selectedId: string | null
  onSelect: (id: string) => void
}

const SHORT: Record<string, string> = {
  Backlog: 'Backlog', 'In Queue': 'Queue', Design: 'Design', Build: 'Build', QA: 'QA',
  'Awaiting Approval': 'Approval', Deploy: 'Deploy', Done: 'Done', Blocked: 'Blocked', Paused: 'Paused',
}

const DAY_MS = 86_400_000

// A real Gantt: every visible initiative plotted against one shared calendar axis
// (not the mockup's hardcoded 2026-06-15 base) — each row's segments are positioned by
// actual days since its own first history entry, relative to that shared axis.
export default function TimelineView({ initiatives, selectedId, onSelect }: Props) {
  const withHistory = initiatives.filter(i => i.history.length > 0)
  if (!withHistory.length) return <p style={{ fontSize: '.78rem', color: 'var(--text-3)' }}>Nothing to plot yet.</p>

  const today = Date.now()
  // Fixed, bounded window — NOT stretched to the furthest projected Deploy Target.
  // Queue-chained targets can land months out when an owner has many items stacked up,
  // which would squash every real segment into an invisible sliver. "todo" segments for
  // items further out than this window just get clipped (see .di-tl-track overflow).
  const starts = withHistory.map(i => new Date(i.history[0].entered_at).getTime())
  const earliestStart = Math.min(...starts, today - 14 * DAY_MS)
  const base = Math.max(earliestStart, today - 60 * DAY_MS)
  const rightEdge = today + 60 * DAY_MS
  const span = rightEdge - base
  const spanDays = span / DAY_MS

  const weekCols = Math.ceil(spanDays / 7)
  const nowPct = ((today - base) / span) * 100

  return (
    <div>
      <div className="di-tl-h">
        <div className="di-tl-name" />
        <div style={{ flex: 1, display: 'flex' }}>
          {Array.from({ length: weekCols }, (_, i) => {
            const d = new Date(base + i * 7 * DAY_MS)
            const isNow = today >= d.getTime() && today < d.getTime() + 7 * DAY_MS
            return (
              <span key={i} className={`di-tl-week${isNow ? ' now' : ''}`}>
                {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )
          })}
        </div>
      </div>
      {withHistory.map(i => {
        const segs = buildStageSegments(i.history, i)
        let offsetDays = (new Date(i.history[0].entered_at).getTime() - base) / DAY_MS
        const bars = segs.map((s, idx) => {
          const left = Math.max(0, (offsetDays / spanDays) * 100)
          const width = Math.max(0, (s.days / spanDays) * 100)
          offsetDays += s.days
          const wide = width > 9
          return (
            <div
              key={`${s.status}-${idx}`}
              className={`di-tl-seg di-bar-seg ${s.kind}`}
              style={{ left: `${left}%`, width: `${width}%` }}
              title={`${s.status} — ${Math.round(s.days)}d`}
            >
              {wide ? `${SHORT[s.status]} ${Math.round(s.days)}d` : ''}
            </div>
          )
        })
        return (
          <div key={i.id} className="di-tl-row" onClick={() => onSelect(i.id)}>
            <div className="di-tl-name" style={i.id === selectedId ? { color: 'var(--blue)', fontWeight: 700 } : undefined}>{i.project_name}</div>
            <div className="di-tl-track">
              {bars}
              <div className="di-tl-now" style={{ left: `${nowPct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
