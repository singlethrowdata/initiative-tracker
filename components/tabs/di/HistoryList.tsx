'use client'

import { DiInitiative } from '@/types'
import { fmt } from '@/lib/ui'
import { stintDays, stageEstimateDays, stageCountdown } from '@/lib/di-scheduling'

interface Props {
  initiative: DiInitiative
}

const BLOCKER_LABEL: Record<string, string> = {
  internal_capacity: 'internal capacity',
  pm_scheduling: 'PM / scheduling',
  client_external: 'client / external',
  other: 'other',
}

/** The stage log: every entered_at/exited_at stint di_status_history has recorded
 * for this initiative, oldest first, with the day count and (for Blocked stints)
 * the reason — the "how long was it in each stage, and why" view that previously
 * didn't exist anywhere; the data was captured on every stage change but only ever
 * read back to compute the Gantt bar's proportions, never shown as a log.
 * Shared by StageHistoryModal (Queued/Completed rows, which have no timeline)
 * and GanttRow's inline detail panel (Active rows) — one source of truth for
 * the current-stage line and the full log table. */
export default function HistoryList({ initiative }: Props) {
  const history = initiative.history
  const countdown = stageCountdown(history, initiative)
  const open = history.find(h => !h.exited_at)
  const rawEst = open ? stageEstimateDays(initiative, open.status) : null
  const estDays = rawEst && rawEst > 0 ? rawEst : null

  return (
    <>
      {open && (
        <p className="stage-current">
          Currently in <b>{open.status}</b> for <b>{Math.round(stintDays(open))} day{Math.round(stintDays(open)) === 1 ? '' : 's'}</b>
          {estDays != null && countdown && (
            countdown.over > 0
              ? <> &mdash; <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{countdown.over}d over</span> the {Math.round(estDays)}d estimate</>
              : <> &mdash; {countdown.remaining}d left on the {Math.round(estDays)}d estimate</>
          )}
        </p>
      )}

      {history.length === 0 ? (
        <p className="stage-hint">No stage history recorded yet.</p>
      ) : (
        <table className="update-table">
          <thead>
            <tr>
              <th>Stage</th>
              <th>Entered</th>
              <th>Exited</th>
              <th>Days</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h, idx) => (
              <tr key={idx}>
                <td>{h.status}</td>
                <td>{fmt(h.entered_at)}</td>
                <td>{h.exited_at ? fmt(h.exited_at) : 'current'}</td>
                <td>{Math.round(stintDays(h))}d</td>
                <td className="ut-desc">
                  {h.status === 'Blocked' && (h.blocker_note || BLOCKER_LABEL[h.blocker_category ?? ''] || 'unspecified')}
                  {h.is_estimated && <span style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>estimated &mdash; no tracked data before migration</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
