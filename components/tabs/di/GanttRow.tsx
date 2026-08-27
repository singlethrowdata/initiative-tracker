'use client'

import { DiInitiative } from '@/types'
import StageBar from './StageBar'
import { IN_FLIGHT_STATUSES } from '@/lib/di-scheduling'

const BLOCKER_LABEL: Record<string, string> = {
  internal_capacity: 'internal capacity',
  pm_scheduling: 'PM / scheduling',
  client_external: 'client / external',
  other: 'other',
}

const SIZE_LETTER: Record<string, string> = { Small: 'S', Medium: 'M', Large: 'L', Custom: 'C' }

function initials(name: string): string {
  const trimmed = (name || '').trim()
  if (!trimmed) return '?'
  const parts = trimmed.split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return trimmed.slice(0, 2).toUpperCase()
}

interface Props {
  initiative: DiInitiative
  isDiTeam: boolean
  onEdit: () => void
}

/** One row of the Active Gantt. No drag-handle here — reordering is only defined
 * for the Queued backlog list (lexicon.md "Queue Order"); Active rows have no
 * specified drag behavior in the approved mockup, so it's omitted. */
export default function GanttRow({ initiative, isDiTeam, onEdit }: Props) {
  const open = initiative.history.find(h => !h.exited_at)
  const varianceWeeks = initiative.variance_weeks
  const varianceLabel = varianceWeeks == null
    ? '\u2014'
    : varianceWeeks > 0 ? `+${varianceWeeks.toFixed(1)}wk` : 'on track'
  const varianceClass = varianceWeeks != null && varianceWeeks > 0 ? 'behind' : 'ontrack'
  const avatarBg = initiative.architect === 'Darian Ward' ? 'var(--grad-warm)' : 'var(--grad)'

  return (
    <div
      className="gantt-row"
      style={isDiTeam ? { cursor: 'pointer' } : undefined}
      onClick={isDiTeam ? onEdit : undefined}
    >
      <div className="gantt-meta">
        <div className="gantt-name-line">
          <span className="gantt-name">{initiative.project_name}</span>
          <span className="size-badge">{SIZE_LETTER[initiative.size_preset] ?? initiative.size_preset}</span>
          {initiative.status === 'Blocked' && <span className="state-tag blocked">&#9208; blocked</span>}
          {initiative.status === 'Paused' && <span className="state-tag paused">&#9208; paused</span>}
          {initiative.status === 'Awaiting Approval' && <span className="state-tag approval">&#8987; approval</span>}
          {initiative.tracker_initiative_id && (
            <span
              className="link-badge"
              title={`Linked to Tracker initiative: ${initiative.tracker_initiative_name ?? initiative.tracker_initiative_id}`}
            >
              <svg viewBox="0 0 24 24">
                <path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.5 1.5" />
                <path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.5-1.5" />
              </svg>
            </span>
          )}
        </div>
        <div className="gantt-sub">
          <span className="owner-avatar" style={{ background: avatarBg }}>{initials(initiative.architect)}</span>
          {IN_FLIGHT_STATUSES.includes(initiative.status) && initiative.architect && (
            <span className="waiting-note">architect: <b>{initiative.architect}</b></span>
          )}
        </div>
        {initiative.status === 'Blocked' && (
          <p className="waiting-note">
            waiting on: <b>{open?.blocker_note || BLOCKER_LABEL[open?.blocker_category ?? ''] || 'unspecified'}</b>
          </p>
        )}
        {initiative.status === 'Paused' && initiative.status_note && (
          <p className="waiting-note">note: <b>{initiative.status_note}</b></p>
        )}
        {isDiTeam && (
          <button className="edit-link" type="button" onClick={e => { e.stopPropagation(); onEdit() }}>
            Edit stages &#8250;
          </button>
        )}
      </div>
      <StageBar initiative={initiative} />
      <div className={`variance ${varianceClass}`}>{varianceLabel}</div>
    </div>
  )
}
