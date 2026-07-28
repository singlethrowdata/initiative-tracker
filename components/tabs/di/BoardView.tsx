'use client'

import { useState } from 'react'
import { DiInitiative } from '@/types'
import { ACTIVE_PIPELINE_STATUSES, currentStageDays, stageEstimateDays } from '@/lib/di-scheduling'

interface Props {
  initiatives: DiInitiative[]
  selectedId: string | null
  onSelect: (id: string) => void
  onStatusChange: (id: string, status: string) => void
}

const SHORT: Record<string, string> = {
  'In Queue': 'Queue', Design: 'Design', Build: 'Build', QA: 'QA', 'Awaiting Approval': 'Approval', Deploy: 'Deploy',
}

// Kanban board over the active pipeline (Backlog/Done/Blocked/Paused live in List view /
// segment filters instead — see the plan this was built from). Real HTML5 drag-and-drop:
// dropping a card in a new column PATCHes status through the same route the List view's
// status dropdown already uses.
export default function BoardView({ initiatives, selectedId, onSelect, onStatusChange }: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)

  return (
    <div className="di-board">
      {ACTIVE_PIPELINE_STATUSES.map(status => {
        const items = initiatives.filter(i => i.status === status)
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
              <span className="di-board-col-count">{items.length}</span>
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
                return (
                  <div
                    key={i.id}
                    className={`di-card${i.id === selectedId ? ' sel' : ''}${draggingId === i.id ? ' dragging' : ''}`}
                    draggable
                    onDragStart={e => { setDraggingId(i.id); e.dataTransfer.setData('text/plain', i.id) }}
                    onDragEnd={() => setDraggingId(null)}
                    onClick={() => onSelect(i.id)}
                  >
                    <p className="di-card-title">{i.project_name}</p>
                    <div className="di-gauge"><i className={over ? 'over' : pct < 70 ? 'ok' : ''} style={{ width: `${pct}%` }} /></div>
                    <div className="di-card-foot">
                      <span>{over ? `${Math.round(actual - (est ?? 0))}d over` : remaining != null ? `${remaining}d left` : '—'}</span>
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
