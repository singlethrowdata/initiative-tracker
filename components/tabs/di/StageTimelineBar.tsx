'use client'

import { DiInitiative, DiStatusHistoryEntry } from '@/types'
import { buildStageSegments } from '@/lib/di-scheduling'

interface Props {
  history: DiStatusHistoryEntry[]
  initiative: Pick<DiInitiative, 'design_wks' | 'build_wks' | 'qa_wks' | 'approval_wks' | 'deploy_wks'>
  big?: boolean
}

const SHORT: Record<string, string> = {
  Backlog: 'Backlog', 'In Queue': 'Queue', Design: 'Design', Build: 'Build', QA: 'QA',
  'Awaiting Approval': 'Approval', Deploy: 'Deploy', Done: 'Done', Blocked: 'Blocked', Paused: 'Paused',
}

// The labeled stage bar — phase name + day count written directly on the segment when
// it's wide enough, a title tooltip as fallback when it's not. Segments are done/now/
// over/todo/hold, computed from real history + buffered estimates (see
// buildStageSegments in lib/di-scheduling.ts). This is the "signature" visual the whole
// dashboard mockup was built around.
export default function StageTimelineBar({ history, initiative, big }: Props) {
  if (!history.length) return <div className="di-bar" />

  const segs = buildStageSegments(history, initiative)
  const total = segs.reduce((a, s) => a + s.days, 0) || 1

  return (
    <div>
      <div className={`di-bar${big ? ' lg' : ''}`}>
        {segs.map((s, i) => {
          const pct = (s.days / total) * 100
          const wide = pct > 13
          const days = Math.round(s.days)
          let label: string
          let title: string
          if (s.kind === 'hold') {
            label = wide ? `${SHORT[s.status]} · held ${days}d` : `${days}d`
            title = `${s.status} — held ${days}d`
          } else if (s.kind === 'over') {
            label = wide ? `${SHORT[s.status]} ${days}d · ${Math.round(s.overDays)}d over` : `${days}d`
            title = `${s.status} — ${days}d (est ${s.estDays != null ? Math.round(s.estDays) : '—'}d)`
          } else if (s.kind === 'todo') {
            label = wide ? SHORT[s.status] : ''
            title = `${s.status} — not started, est ${days}d`
          } else {
            label = wide ? `${SHORT[s.status]} ${days}d` : `${days}d`
            title = `${s.status} — ${days}d${s.estDays != null ? ` (est ${Math.round(s.estDays)}d)` : ''}`
          }
          return (
            <div key={`${s.status}-${i}`} className={`di-bar-seg ${s.kind}`} style={{ width: `${pct}%` }} title={title}>
              {label}
            </div>
          )
        })}
      </div>
      {big && (
        <div className="di-bar-axis">
          {segs.map((s, i) => (
            <span key={`${s.status}-${i}`} style={{ width: `${(s.days / total) * 100}%` }}>{SHORT[s.status]}</span>
          ))}
        </div>
      )}
    </div>
  )
}
