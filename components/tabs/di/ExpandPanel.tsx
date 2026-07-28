'use client'

import { useEffect, useState } from 'react'
import { DiInitiative } from '@/types'
import { ACTIVE_PIPELINE_STATUSES, stageEstimateDays } from '@/lib/di-scheduling'

interface UpdateRow {
  id: string
  user_name: string
  content: string
  created_at: string
}

interface Props {
  initiative: DiInitiative
}

const SHORT: Record<string, string> = {
  'In Queue': 'Queue', Design: 'Design', Build: 'Build', QA: 'QA', 'Awaiting Approval': 'Approval', Deploy: 'Deploy',
}

// The List view's per-row expand panel — actual-vs-estimate per stage plus the latest 2
// updates, so a quick glance doesn't require opening the full context rail.
export default function ExpandPanel({ initiative }: Props) {
  const [updates, setUpdates] = useState<UpdateRow[] | null>(null)

  useEffect(() => {
    fetch(`/api/di-initiatives/${initiative.id}/updates`).then(r => r.json()).then(rows => setUpdates(Array.isArray(rows) ? rows : []))
  }, [initiative.id])

  const byStatus = new Map(initiative.history.map(h => [h.status, h]))

  return (
    <div className="di-exp">
      <p className="di-exp-heading">Days per stage — actual against estimate</p>
      <div className="di-exp-grid">
        {ACTIVE_PIPELINE_STATUSES.map(status => {
          const h = byStatus.get(status)
          const est = stageEstimateDays(initiative, status)
          const actual = h ? Math.round(((h.exited_at ? new Date(h.exited_at).getTime() : Date.now()) - new Date(h.entered_at).getTime()) / 86_400_000) : null
          const over = actual != null && est != null && actual > est
          return (
            <div key={status} className="di-exp-stat">
              <p className="di-exp-label">{SHORT[status]}</p>
              <p className="di-exp-value" style={over ? { color: 'var(--blue)' } : undefined}>{actual != null ? `${actual}d` : '—'}</p>
              <p className="di-exp-est">est {est != null ? Math.round(est) : 0}d</p>
            </div>
          )
        })}
      </div>
      <p className="di-exp-heading">Latest updates</p>
      <ul className="di-mini-feed">
        {updates == null ? (
          <li style={{ color: 'var(--text-3)' }}>Loading…</li>
        ) : updates.length === 0 ? (
          <li style={{ color: 'var(--text-3)' }}>No updates yet.</li>
        ) : (
          updates.slice(0, 2).map(u => (
            <li key={u.id}><span className="d">{new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span><span>{u.content}</span></li>
          ))
        )}
      </ul>
    </div>
  )
}
