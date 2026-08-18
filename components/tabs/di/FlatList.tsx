'use client'

import { DiInitiative } from '@/types'
import { diStatusClass } from '@/lib/ui'
import { currentStageDays } from '@/lib/di-scheduling'

interface Props {
  initiatives: DiInitiative[]
  selectedId: string | null
  onSelect: (id: string) => void
  emptyLabel: string
}

const BLOCKER_LABEL: Record<string, string> = {
  internal_capacity: 'Internal Capacity', pm_scheduling: 'PM / Meeting Scheduling',
  client_external: 'Client / External', other: 'Other',
}

// Simple flat list for the Blocked/Paused and Done buckets — a kanban column doesn't
// fit these (they're exceptions and terminal states, not stages in the flow), but they
// still need to be readable: why something's stuck, or when it shipped.
export default function FlatList({ initiatives, selectedId, onSelect, emptyLabel }: Props) {
  if (!initiatives.length) return <div className="di-flat-empty">{emptyLabel}</div>

  return (
    <div className="di-flat-list">
      {initiatives.map(i => {
        const openStage = i.history.find(h => !h.exited_at)
        const days = currentStageDays(i.history)
        return (
          <div key={i.id} className={`di-flat-row${i.id === selectedId ? ' sel' : ''}`} onClick={() => onSelect(i.id)}>
            <span className={`pill ${diStatusClass(i.status)}`}>{i.status}</span>
            <span className="di-flat-name">{i.project_name}</span>
            <span className="di-flat-owner">{i.owner ? i.owner.split(' ')[0] : '—'}</span>
            <span className="di-flat-reason">
              {openStage?.blocker_category
                ? `${BLOCKER_LABEL[openStage.blocker_category] ?? openStage.blocker_category}${openStage.blocker_note ? ` — ${openStage.blocker_note}` : ''}`
                : i.date_completed
                  ? `Completed ${new Date(i.date_completed).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                  : ''}
            </span>
            <span className="di-flat-days">{days != null ? `${Math.round(days)}d` : '—'}</span>
          </div>
        )
      })}
    </div>
  )
}
