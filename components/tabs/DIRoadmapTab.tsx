'use client'

import { useState, useEffect, useCallback } from 'react'
import { DiInitiative, TeamMember } from '@/types'
import { OWNER_VALUES, PRIORITY_VALUES, currentStageDays, stageCountdown } from '@/lib/di-scheduling'
import { diStatusClass } from '@/lib/ui'
import StageTimelineBar from '@/components/tabs/di/StageTimelineBar'
import StageBand from '@/components/tabs/di/StageBand'
import CapacityStrip from '@/components/tabs/di/CapacityStrip'
import ExpandPanel from '@/components/tabs/di/ExpandPanel'
import BoardView from '@/components/tabs/di/BoardView'
import TimelineView from '@/components/tabs/di/TimelineView'
import CreateDIInitiativeModal from '@/components/modals/CreateDIInitiativeModal'
import EditDIInitiativeModal from '@/components/modals/EditDIInitiativeModal'
import DIDetailsPanel from '@/components/details/DIDetailsPanel'
import ConfirmModal from '@/components/modals/ConfirmModal'

interface Props {
  user: { email: string; name: string }
  canDelete: boolean
  teamList: TeamMember[]
}

type ViewMode = 'list' | 'board' | 'timeline'
type Segment = 'all' | 'flight' | 'approval' | 'held' | 'backlog'

const SEGMENTS: { key: Segment; label: string; test: (i: DiInitiative) => boolean }[] = [
  { key: 'all', label: 'Everything', test: () => true },
  { key: 'flight', label: 'In Flight', test: i => ['Design', 'Build', 'QA', 'Deploy'].includes(i.status) },
  { key: 'approval', label: 'Awaiting Approval', test: i => i.status === 'Awaiting Approval' },
  { key: 'held', label: 'Blocked or Paused', test: i => i.status === 'Blocked' || i.status === 'Paused' || !!i.history.find(h => !h.exited_at)?.blocker_category },
  { key: 'backlog', label: 'Backlog', test: i => i.status === 'Backlog' || i.status === 'In Queue' },
]

export default function DIRoadmapTab({ canDelete }: Props) {
  const [initiatives, setInitiatives] = useState<DiInitiative[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<ViewMode>('list')
  const [segment, setSegment] = useState<Segment>('all')
  const [sortMode, setSortMode] = useState<'over' | 'priority'>('over')
  const [search, setSearch] = useState('')
  const [ownerFilter, setOwnerFilter] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [openRows, setOpenRows] = useState<Set<string>>(new Set())
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<DiInitiative | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DiInitiative | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await fetch('/api/di-initiatives').then(r => r.json())
    setInitiatives(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const visible = initiatives
    .filter(i => SEGMENTS.find(s => s.key === segment)!.test(i))
    .filter(i => !search || i.project_name.toLowerCase().includes(search.toLowerCase()))
    .filter(i => !ownerFilter || i.owner === ownerFilter)
    .sort((a, b) => {
      if (sortMode === 'over') {
        const overA = stageCountdown(a.history, a)?.over ?? 0
        const overB = stageCountdown(b.history, b)?.over ?? 0
        if (overB !== overA) return overB - overA
      }
      return (b.rice_score ?? 0) - (a.rice_score ?? 0)
    })

  async function handleStatusChange(id: string, status: string) {
    const res = await fetch(`/api/di-initiatives/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      alert(body.error ?? 'Failed to change status.')
      return
    }
    load()
  }

  async function handleDeleteConfirmed() {
    if (!deleteTarget) return
    await fetch(`/api/di-initiatives/${deleteTarget.id}`, { method: 'DELETE' })
    setInitiatives(prev => prev.filter(i => i.id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  function toggleRow(id: string) {
    setOpenRows(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selected = initiatives.find(i => i.id === selectedId) ?? null

  return (
    <>
      <div className="tracker-wrap">
        <div className="tracker-top">
          <h3>D+I Roadmap <span style={{ fontWeight: 400, fontSize: '.72rem', color: 'var(--text-3)' }}>· {initiatives.length} initiative{initiatives.length === 1 ? '' : 's'}</span></h3>
          <div className="tracker-top-btns">
            <button className="btn btn-grad btn-sm" onClick={() => setShowCreate(true)}>+ New Initiative</button>
          </div>
        </div>

        {loading ? (
          <div className="loading"><div className="spinner" /><div>Loading…</div></div>
        ) : (
          <div className="di-shell">
            <div style={{ minWidth: 0 }}>
              <StageBand initiatives={initiatives} />
              <CapacityStrip initiatives={initiatives} />

              <div className="di-views">
                {(['list', 'board', 'timeline'] as ViewMode[]).map(v => (
                  <button key={v} className={`di-view-btn ${view === v ? 'on' : ''}`} onClick={() => setView(v)}>
                    {v === 'list' ? 'List' : v === 'board' ? 'Board' : 'Timeline'}
                  </button>
                ))}
                <span style={{ flex: 1 }} />
                <button className="di-view-btn" onClick={() => setSortMode(m => (m === 'over' ? 'priority' : 'over'))}>
                  {sortMode === 'over' ? 'Sorted by time over estimate' : 'Sorted by priority and RICE'}
                </button>
              </div>

              <div className="filter-bar" style={{ marginBottom: '.5rem' }}>
                <input type="text" placeholder="Search initiatives…" value={search} onChange={e => setSearch(e.target.value)} />
                <select value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)}>
                  <option value="">All owners</option>
                  {OWNER_VALUES.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>

              <div className="di-filters">
                {SEGMENTS.map(s => (
                  <button key={s.key} className={`di-filter-pill ${segment === s.key ? 'on' : ''}`} onClick={() => setSegment(s.key)}>
                    {s.label} <b>{initiatives.filter(s.test).length}</b>
                  </button>
                ))}
              </div>

              {view === 'board' ? (
                <BoardView initiatives={visible} selectedId={selectedId} onSelect={setSelectedId} onStatusChange={handleStatusChange} />
              ) : view === 'timeline' ? (
                <TimelineView initiatives={visible} selectedId={selectedId} onSelect={setSelectedId} />
              ) : visible.length === 0 ? (
                <div className="empty">
                  <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></svg>
                  <h3>Nothing in this segment</h3>
                  <p>Try Everything, or clear the search.</p>
                </div>
              ) : (
                <>
                  {visible.map(i => {
                    const open = openRows.has(i.id)
                    const countdown = stageCountdown(i.history, i)
                    const days = currentStageDays(i.history)
                    return (
                      <div key={i.id} className="di-row-wrap">
                        <div
                          className={`lr ${i.id === selectedId ? 'sel' : ''}`}
                          onClick={() => setSelectedId(i.id)}
                        >
                          <div className="di-row-top">
                            <span style={{ fontSize: '.78rem', color: 'var(--text-3)' }}>{i.queue_number ?? '—'}</span>
                            <div className="di-row-title">
                              <div style={{ fontWeight: 700, fontSize: '.85rem', display: 'flex', alignItems: 'center' }}>
                                <button className="di-chev" onClick={e => { e.stopPropagation(); toggleRow(i.id) }} aria-label={open ? 'Collapse' : 'Expand'}>
                                  {open ? '▾' : '▸'}
                                </button>
                                {i.project_name}
                                {i.history.find(h => !h.exited_at)?.blocker_category && <span className="di-tag-hold">Held</span>}
                              </div>
                              <div style={{ fontSize: '.7rem', color: 'var(--text-3)' }}>{i.tier} · {i.type}</div>
                            </div>
                            <span className={`pill ${diStatusClass(i.status)}`}>{i.status}</span>
                            <select
                              className="inl" onClick={e => e.stopPropagation()}
                              value={i.priority} onChange={async e => {
                                await fetch(`/api/di-initiatives/${i.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ priority: e.target.value }) })
                                load()
                              }}
                            >
                              {PRIORITY_VALUES.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                            <select
                              className="inl" onClick={e => e.stopPropagation()}
                              value={i.owner || ''} onChange={async e => {
                                await fetch(`/api/di-initiatives/${i.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ owner: e.target.value }) })
                                load()
                              }}
                            >
                              {OWNER_VALUES.map(o => <option key={o} value={o}>{o.split(' ')[0]}</option>)}
                            </select>
                            <span className="di-row-next" style={{ color: countdown && countdown.over > 0 ? 'var(--blue)' : 'var(--green)' }}>
                              {i.status === 'Backlog' ? '—' : countdown ? (countdown.over > 0 ? `${countdown.over}d over` : `${countdown.remaining}d left`) : days != null ? `${Math.round(days)}d` : '—'}
                            </span>
                          </div>
                          <div className="di-row-bar">
                            <StageTimelineBar history={i.history} initiative={i} big />
                          </div>
                        </div>
                        {open && <ExpandPanel initiative={i} />}
                      </div>
                    )
                  })}
                </>
              )}
            </div>

            <DIDetailsPanel
              initiative={selected}
              onRefresh={load}
              onEdit={() => selected && setEditTarget(selected)}
              canDelete={canDelete}
              onDelete={() => selected && setDeleteTarget(selected)}
            />
          </div>
        )}
      </div>

      {showCreate && (
        <CreateDIInitiativeModal
          onClose={() => setShowCreate(false)}
          onCreated={i => { setInitiatives(prev => [i, ...prev]); setShowCreate(false) }}
        />
      )}

      {editTarget && (
        <EditDIInitiativeModal
          initiative={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); load() }}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete D+I Initiative"
          message={`Are you sure you want to delete "${deleteTarget.project_name}"? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={handleDeleteConfirmed}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </>
  )
}
