'use client'

import { DiInitiative } from '@/types'
import StageBar from './StageBar'
import { IN_FLIGHT_STATUSES, stintDays, stageEstimateDays, stageCountdown } from '@/lib/di-scheduling'
import { stageAgeClass } from '@/lib/ui'

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
  onChangeStage: () => void
  onNotes: () => void
  onHistory: () => void
}

/** One row of the Active Gantt. No drag-handle here — reordering is only defined
 * for the Queued backlog list (lexicon.md "Queue Order"); Active rows have no
 * specified drag behavior in the approved mockup, so it's omitted. */
export default function GanttRow({ initiative, isDiTeam, onEdit, onChangeStage, onNotes, onHistory }: Props) {
  const open = initiative.history.find(h => !h.exited_at)
  const varianceWeeks = initiative.variance_weeks
  const varianceLabel = varianceWeeks == null
    ? '\u2014'
    : varianceWeeks > 0 ? `+${varianceWeeks.toFixed(1)}wk` : 'on track'
  const varianceClass = varianceWeeks != null && varianceWeeks > 0 ? 'behind' : 'ontrack'
  const avatarBg = initiative.architect === 'Darian Ward' ? 'var(--grad-warm)' : 'var(--grad)'
  const curDays = open ? stintDays(open) : null
  const rawEst = open ? stageEstimateDays(initiative, open.status) : null
  const estDays = rawEst && rawEst > 0 ? rawEst : null
  const countdown = open ? stageCountdown(initiative.history, initiative) : null
  const ageClass = estDays != null && countdown ? stageAgeClass(curDays ?? 0, estDays * 0.7, estDays) : 'days-badge days-neutral'
  const ageLabel = curDays == null ? null : estDays != null
    ? `${Math.round(curDays)}d in ${open!.status} (est ${Math.round(estDays)}d)`
    : `${Math.round(curDays)}d in ${open!.status}`

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
          {ageLabel && <span className={ageClass}>{ageLabel}</span>}
        </div>
        {initiative.status === 'Blocked' && (
          <p className="waiting-note">
            waiting on: <b>{open?.blocker_note || BLOCKER_LABEL[open?.blocker_category ?? ''] || 'unspecified'}</b>
          </p>
        )}
        {initiative.status === 'Paused' && initiative.status_note && (
          <p className="waiting-note">note: <b>{initiative.status_note}</b></p>
        )}
        <div className="gantt-actions">
          <button className="edit-link" type="button" onClick={e => { e.stopPropagation(); onHistory() }}>
            History &#8250;
          </button>
          <button className="edit-link" type="button" onClick={e => { e.stopPropagation(); onNotes() }}>
            Notes &#8250;
          </button>
          {isDiTeam && (
            <>
              <button className="edit-link" type="button" onClick={e => { e.stopPropagation(); onEdit() }}>
                Edit details &#8250;
              </button>
              <button className="edit-link" type="button" onClick={e => { e.stopPropagation(); onChangeStage() }}>
                Change Stage &#8250;
              </button>
            </>
          )}
        </div>
      </div>
      <div className="gantt-timeline">
        {initiative.description && <p className="gantt-summary">{initiative.description}</p>}
        <StageBar initiative={initiative} />
      </div>
      <div className={`variance ${varianceClass}`}>{varianceLabel}</div>
    </div>
  )
}
