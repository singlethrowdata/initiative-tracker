'use client'

import { DiStatusHistoryEntry } from '@/types'
import { diSegClass } from '@/lib/ui'

interface Props {
  history: DiStatusHistoryEntry[]
  expanded?: boolean
}

function daysInStage(h: DiStatusHistoryEntry): number {
  const end = h.exited_at ? new Date(h.exited_at).getTime() : Date.now()
  const start = new Date(h.entered_at).getTime()
  return Math.max(end - start, 60_000) // floor at 1 minute so a same-day segment still renders a sliver
}

// The color-coded stacked bar: one segment per status the initiative has passed
// through, sized by time spent — turns Stage Duration into an at-a-glance timeline
// (see lexicon.md "Stage Duration").
export default function StageTimelineBar({ history, expanded = false }: Props) {
  if (!history.length) return <div className="di-timeline-bar" />

  const durations = history.map(daysInStage)
  const total = durations.reduce((a, b) => a + b, 0)

  return (
    <div>
      <div className={`di-timeline-bar${expanded ? ' expanded' : ''}`}>
        {history.map((h, i) => {
          const pct = total ? (durations[i] / total) * 100 : 0
          const days = Math.round(durations[i] / 86_400_000 * 10) / 10
          const label = `${h.status}: ${days}d${h.exited_at ? '' : ' (current)'}${h.blocker_category ? ` — ${h.blocker_category}` : ''}`
          return (
            <div
              key={h.id}
              className={`di-timeline-seg ${diSegClass(h.status)}`}
              style={{ width: `${pct}%` }}
              title={label}
            />
          )
        })}
      </div>
      {expanded && (
        <div className="di-timeline-legend">
          {history.map(h => {
            const days = Math.round(daysInStage(h) / 86_400_000 * 10) / 10
            return (
              <span key={h.id} className="di-timeline-legend-item">
                <span className={`d ${diSegClass(h.status)}`} />
                {h.status} — {days}d{!h.exited_at && ' (current)'}
                {h.blocker_category && ` · ${h.blocker_category.replace('_', ' ')}`}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
