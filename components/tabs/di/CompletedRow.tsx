'use client'

import { DiInitiative } from '@/types'

interface Props {
  initiative: DiInitiative
  onNotes: () => void
  onHistory: () => void
}

/** One row of the collapsed Completed list. Read-only — no Change Stage here;
 * reopening a Done initiative isn't a defined flow, so it isn't offered. */
export default function CompletedRow({ initiative, onNotes, onHistory }: Props) {
  const completedLabel = initiative.date_completed
    ? new Date(initiative.date_completed).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '\u2014'

  return (
    <div className="completed-row">
      <span className="completed-name">{initiative.project_name}</span>
      <span className="completed-meta">
        {initiative.owner || '\u2014'} &middot; completed {completedLabel}
      </span>
      <button className="edit-link" type="button" onClick={onHistory}>
        History &#8250;
      </button>
      <button className="edit-link" type="button" onClick={onNotes}>
        Notes &#8250;
      </button>
    </div>
  )
}
