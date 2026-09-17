'use client'

import { useState } from 'react'
import { DiInitiative } from '@/types'
import NotesThread from '@/components/tabs/di/NotesThread'

interface Props {
  initiative: DiInitiative
  isDiTeam: boolean
  onClose: () => void
}

/** Notes for rows with no inline timeline (Queued/Completed) — Active rows
 * show this content inline below the Gantt bar via NotesThread directly;
 * see GanttRow.tsx. */
export default function DiNotesModal({ initiative, isDiTeam, onClose }: Props) {
  const [composing, setComposing] = useState(false)

  return (
    <div className="overlay show" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <h3>Notes — {initiative.project_name}</h3>

        <div className="modal-body">
          <NotesThread initiative={initiative} isDiTeam={isDiTeam} composing={composing} onCloseCompose={() => setComposing(false)} />
        </div>

        <div className="modal-foot">
          {isDiTeam && !composing && (
            <button type="button" className="btn btn-outline" onClick={() => setComposing(true)}>+ Add Note</button>
          )}
          <button type="button" className="btn btn-outline" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
