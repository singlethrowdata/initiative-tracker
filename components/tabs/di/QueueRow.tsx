'use client'

import { DiInitiative } from '@/types'

const SIZE_LETTER: Record<string, string> = { Small: 'S', Medium: 'M', Large: 'L', Custom: 'C' }

interface Props {
  initiative: DiInitiative
  rank: number
  isDiTeam: boolean
  dragging: boolean
  onDragStart: () => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: () => void
  onDragEnd: () => void
}

/** One row of the Queued backlog list. Drag-and-drop (native HTML5 DnD, matching
 * the mockup's drag-handle glyph) is only wired up here, per lexicon.md's Queue
 * Order entry — the Active Gantt has no such affordance. */
export default function QueueRow({ initiative, rank, isDiTeam, dragging, onDragStart, onDragOver, onDrop, onDragEnd }: Props) {
  return (
    <div
      className={`queue-row${dragging ? ' dragging' : ''}`}
      draggable={isDiTeam}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      {isDiTeam && <span className="drag-handle" aria-hidden="true">&#10241;</span>}
      <span className="queue-rank">{rank}</span>
      <span className="queue-name">
        {initiative.project_name}{' '}
        <span className="size-badge">{SIZE_LETTER[initiative.size_preset] ?? initiative.size_preset}</span>
      </span>
      <span className="queue-rice">RICE {initiative.rice_score != null ? Math.round(initiative.rice_score) : '\u2014'}</span>
      <span className="queue-eta">
        {initiative.starts_in_weeks != null ? `starts in ~${initiative.starts_in_weeks.toFixed(1)} wks` : 'starts in \u2014'}
      </span>
    </div>
  )
}
