'use client'

import { useCallback, useEffect, useState } from 'react'
import { DiInitiative } from '@/types'
import { QUEUED_STATUSES } from '@/lib/di-scheduling'
import CapacityChip from '@/components/tabs/di/CapacityChip'
import NextOpeningCard from '@/components/tabs/di/NextOpeningCard'
import GanttRow from '@/components/tabs/di/GanttRow'
import QueueRow from '@/components/tabs/di/QueueRow'
import CreateDIInitiativeModal from '@/components/modals/CreateDIInitiativeModal'
import EditDIInitiativeModal from '@/components/modals/EditDIInitiativeModal'

interface SizeEntry { startsInWeeks: number; finishesInWeeks: number }
interface Capacity {
  currentDrawCount: number
  wipCap: number
  nextOpeningBySize: Record<'Small' | 'Medium' | 'Large', SizeEntry>
}

// The Active Gantt shows every project that has actually started work — real
// pipeline stages plus Blocked/Paused (which pause mid-pipeline but still belong
// on the timeline). Backlog/In Queue live in the Queued list below; Done doesn't
// have a dedicated section in the approved mockup.
const STARTED_STATUSES = ['Design', 'Build', 'QA', 'Awaiting Approval', 'Deploy', 'Blocked', 'Paused']

export default function DIRoadmapTab() {
  const [initiatives, setInitiatives] = useState<DiInitiative[]>([])
  const [capacity, setCapacity] = useState<Capacity | null>(null)
  const [isDiTeam, setIsDiTeam] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<DiInitiative | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [queueOrder, setQueueOrder] = useState<string[]>([])

  const load = useCallback(async () => {
    const res = await fetch('/api/di-initiatives')
    if (!res.ok) { setLoading(false); return }
    const data = await res.json()
    setInitiatives(Array.isArray(data.initiatives) ? data.initiatives : [])
    setCapacity(data.capacity ?? null)
    setIsDiTeam(!!data.isDiTeam)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const activeRows = initiatives.filter(i => STARTED_STATUSES.includes(i.status))

  const queuedRowsSorted = initiatives
    .filter(i => QUEUED_STATUSES.includes(i.status))
    .slice()
    .sort((a, b) => (a.queue_position ?? Infinity) - (b.queue_position ?? Infinity))

  // Local drag order is seeded from the server order whenever the underlying data
  // changes (e.g. after a refetch), then diverges locally while a drag is in
  // progress, then gets persisted back on drop.
  useEffect(() => {
    setQueueOrder(queuedRowsSorted.map(i => i.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initiatives])

  const queuedById = new Map(queuedRowsSorted.map(i => [i.id, i]))
  const orderedQueue = queueOrder
    .map(id => queuedById.get(id))
    .filter((i): i is DiInitiative => !!i)

  async function persistReorder(ids: string[]) {
    await fetch('/api/di-initiatives/reorder', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    load()
  }

  function handleDragOver(e: React.DragEvent, overId: string) {
    e.preventDefault()
    if (!dragId || dragId === overId) return
    setQueueOrder(prev => {
      const from = prev.indexOf(dragId)
      const to = prev.indexOf(overId)
      if (from === -1 || to === -1) return prev
      const next = prev.slice()
      next.splice(from, 1)
      next.splice(to, 0, dragId)
      return next
    })
  }

  function handleDrop() {
    if (dragId) persistReorder(queueOrder)
    setDragId(null)
  }

  if (loading) {
    return <div className="loading"><div className="spinner" /><div>Loading&hellip;</div></div>
  }

  return (
    <>
      <div className="di-roadmap">
        <div className="page-head">
          <h1>D+I Roadmap</h1>
          {capacity && (
            <CapacityChip currentDrawCount={capacity.currentDrawCount} wipCap={capacity.wipCap} />
          )}
        </div>

        {capacity && <NextOpeningCard nextOpeningBySize={capacity.nextOpeningBySize} />}

        <div className="section-h">
          <h2>Active</h2>
          {isDiTeam && (
            <div className="section-actions">
              <button className="btn btn-grad" type="button" onClick={() => setShowCreate(true)}>+ Add project</button>
            </div>
          )}
        </div>

        <div className="gantt-wrap">
          <div className="gantt-scale-head">
            <span className="lbl">Project</span>
            <span className="lbl">Timeline</span>
            <span className="lbl" style={{ textAlign: 'right' }}>Variance</span>
            <span className="today-lbl">Today</span>
          </div>
          <div className="gantt-rows">
            {activeRows.length === 0 ? (
              <div className="empty"><p>No active projects.</p></div>
            ) : (
              activeRows.map(row => (
                <GanttRow key={row.id} initiative={row} isDiTeam={isDiTeam} onEdit={() => setEditTarget(row)} />
              ))
            )}
          </div>
        </div>

        <div className="section-h">
          <h2>Queued &mdash; next up, by priority</h2>
          {isDiTeam && (
            <div className="section-actions">
              <span className="btn" aria-hidden="true">&#8645; Drag to reorder</span>
            </div>
          )}
        </div>

        <div className="queue-list">
          {orderedQueue.length === 0 ? (
            <div className="empty"><p>Nothing in the queue.</p></div>
          ) : (
            orderedQueue.map((row, idx) => (
              <QueueRow
                key={row.id}
                initiative={row}
                rank={idx + 1}
                isDiTeam={isDiTeam}
                dragging={dragId === row.id}
                onDragStart={() => setDragId(row.id)}
                onDragOver={e => handleDragOver(e, row.id)}
                onDrop={handleDrop}
                onDragEnd={() => setDragId(null)}
              />
            ))
          )}
        </div>
      </div>

      {showCreate && (
        <CreateDIInitiativeModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load() }}
        />
      )}

      {editTarget && (
        <EditDIInitiativeModal
          initiative={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); load() }}
        />
      )}
    </>
  )
}
