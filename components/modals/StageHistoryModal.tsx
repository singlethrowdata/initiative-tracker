'use client'

import { DiInitiative } from '@/types'
import HistoryList from '@/components/tabs/di/HistoryList'

interface Props {
  initiative: DiInitiative
  onClose: () => void
}

/** Stage log for rows with no inline timeline (Queued/Completed) — Active
 * rows show this content inline below the Gantt bar via HistoryList directly;
 * see GanttRow.tsx. */
export default function StageHistoryModal({ initiative, onClose }: Props) {
  return (
    <div className="overlay show" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <h3>Stage History &mdash; {initiative.project_name}</h3>

        <div className="modal-body">
          <HistoryList initiative={initiative} />
        </div>

        <div className="modal-foot">
          <button type="button" className="btn btn-outline" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
