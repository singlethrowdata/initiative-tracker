'use client'

import { DiInitiative } from '@/types'
import { diStatusClass, priorityClass } from '@/lib/ui'
import { currentStageDays, stageCountdown } from '@/lib/di-scheduling'

interface Props {
  initiatives: DiInitiative[]
  statuses: string[]
  selectedId: string | null
  onSelect: (id: string) => void
}

const SHORT: Record<string, string> = {
  Backlog: 'Backlog', 'In Queue': 'In Queue', Design: 'Design', Build: 'Build', QA: 'QA',
  'Awaiting Approval': 'Awaiting Approval', Deploy: 'Deploy',
}

// The team's working view — every active-pipeline initiative in one list, grouped and
// sorted by status in pipeline order (not a kanban column per status, a section per
// status), so status is still the primary axis but every field (priority, owner, time
// signal) reads on one line instead of being squeezed onto a card.
export default function ListView({ initiatives, statuses, selectedId, onSelect }: Props) {
  return (
    <div className="di-list">
      {statuses.map(status => {
        const items = initiatives.filter(i => i.status === status)
        if (!items.length) return null
        return (
          <div key={status} className="di-list-group">
            <div className="di-list-group-head">
              <span>{SHORT[status] ?? status}</span>
              <span className="di-list-group-count">{items.length}</span>
            </div>
            {items.map(i => {
              const countdown = stageCountdown(i.history, i)
              const days = currentStageDays(i.history)
              const held = i.history.find(h => !h.exited_at)?.blocker_category
              return (
                <div key={i.id} className={`di-flat-row${i.id === selectedId ? ' sel' : ''}`} onClick={() => onSelect(i.id)}>
                  <span className={`pill ${diStatusClass(i.status)}`}>{i.status}</span>
                  <span className="di-flat-name">{i.project_name}{held && <span className="di-tag-hold">Held</span>}</span>
                  <span className={priorityClass(i.priority)}>{i.priority}</span>
                  <span className="di-flat-owner">{i.owner ? i.owner.split(' ')[0] : '—'}</span>
                  <span className="di-flat-reason">
                    {countdown
                      ? (countdown.over > 0 ? `${countdown.over}d over estimate` : `${countdown.remaining}d until next stage`)
                      : status === 'Backlog' && days != null ? `${Math.round(days)}d waiting` : ''}
                  </span>
                  <span className="di-flat-days">{i.queue_number != null ? `#${i.queue_number}` : ''}</span>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
