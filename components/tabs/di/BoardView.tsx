'use client'

import { useState } from 'react'
import { DiInitiative } from '@/types'
import { BOARD_STATUSES, currentStageDays, stageEstimateDays, median } from '@/lib/di-scheduling'

interface Props {
  initiatives: DiInitiative[]
  selectedId: string | null
  onSelect: (id: string) => void
  onStatusChange: (id: string, status: string) => void
}

const SHORT: Record<string, string> = {
  Backlog: 'Backlog', 'In Queue': 'Queue', Design: 'Design', Build: 'Build', QA: 'QA',
  'Awaiting Approval': 'Approval', Deploy: 'Deploy',
}

// Kanban over the full board lifecycle (Backlog through Deploy — see BOARD_STATUSES).
// Done/Blocked/Paused live in their own bucket toggle instead, see DIRoadmapTab. Real
// HTML5 drag-and-drop: dropping a card in a new column PATCHes status through the same
// route the status dropdowns already use. Each column header carries count + median
// days-in-stage directly — the "where's the pileup" signal, without a separate KPI row.
export default function BoardView({ initiatives, selectedId, onSelect, onStatusChange }: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)

  return (
    <div className="di-board">
      {BOARD_STATUSES.map(status => {
        const items = initiatives.filter(i => i.status === status)
        const days = items.map(i => Math.round(currentStageDays(i.history) ?? 0))
        return (
          <div
            key={status}
            className={`di-board-col${dragOverCol === status ? ' drag-over' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOverCol(status) }}
            onDragLeave={() => setDragOverCol(prev => (prev === status ? null : prev))}
            onDrop={e => {
              e.preventDefault()
              setDragOverCol(null)
              const id = e.dataTransfer.getData('text/plain')
              if (id && id !== '') onStatusChange(id, status)
            }}
          >
            <div className="di-board-col-head">
              <span className="di-board-col-name">{SHORT[status]}</span>
              <span className="di-board-col-stats">{items.length} · {median(days)}d med</span>
            </div>
            {items.length === 0 ? (
              <div className="di-board-empty">Open</div>
            ) : (
              items.map(i => {
                const actual = currentStageDays(i.history) ?? 0
                const est = stageEstimateDays(i, i.status)
                const pct = est ? Math.min(100, Math.round((actual / est) * 100)) : 0
                const over = est != null && actual > est
                const remaining = est != null ? Math.round(est - actual) : null
                const held = i.history.find(h => !h.exited_at)?.blocker_category
                return (
                  <div
                    key={i.id}
                    className={`di-card${i.id === selectedId ? ' sel' : ''}${draggingId === i.id ? ' dragging' : ''}`}
                    draggable
                    onDragStart={e => { setDraggingId(i.id); e.dataTransfer.setData('text/plain', i.id) }}
                    onDragEnd={() => setDraggingId(null)}
                    onClick={() => onSelect(i.id)}
                  >
                    <p className="di-card-title">{i.project_name}{held && <span className="di-tag-hold">Held</span>}</p>
                    <div className="di-gauge"><i className={over ? 'over' : pct < 70 ? 'ok' : ''} style={{ width: `${pct}%` }} /></div>
                    <div className="di-card-foot">
                      <span>{over ? `${Math.round(actual - (est ?? 0))}d over` : remaining != null ? `${remaining}d left` : status === 'Backlog' ? `${Math.round(actual)}d waiting` : '—'}</span>
                      <span>{i.owner ? i.owner.split(' ')[0] : '—'}</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )
      })}
    </div>
  )
}
