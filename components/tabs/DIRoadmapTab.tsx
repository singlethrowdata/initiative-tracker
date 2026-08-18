'use client'

import { useState, useEffect, useCallback } from 'react'
import { DiInitiative, TeamMember } from '@/types'
import { OWNER_VALUES, stageCountdown } from '@/lib/di-scheduling'
import InsightBar from '@/components/tabs/di/InsightBar'
import BoardView from '@/components/tabs/di/BoardView'
import FlatList from '@/components/tabs/di/FlatList'
import CreateDIInitiativeModal from '@/components/modals/CreateDIInitiativeModal'
import EditDIInitiativeModal from '@/components/modals/EditDIInitiativeModal'
import DIDetailsPanel from '@/components/details/DIDetailsPanel'
import ConfirmModal from '@/components/modals/ConfirmModal'

interface Props {
  user: { email: string; name: string }
  canDelete: boolean
  teamList: TeamMember[]
}

type Bucket = 'active' | 'blocked' | 'done'

export default function DIRoadmapTab({ canDelete }: Props) {
  const [initiatives, setInitiatives] = useState<DiInitiative[]>([])
  const [loading, setLoading] = useState(true)
  const [bucket, setBucket] = useState<Bucket>('active')
  const [search, setSearch] = useState('')
  const [ownerFilter, setOwnerFilter] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
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

  // Most at-risk first within each bucket/column — time already over its stage
  // estimate, then priority/RICE as the tiebreak. One fixed, sensible order instead of
  // a manual sort-mode toggle.
  const sorted = [...initiatives].sort((a, b) => {
    const overA = stageCountdown(a.history, a)?.over ?? 0
    const overB = stageCountdown(b.history, b)?.over ?? 0
    if (overB !== overA) return overB - overA
    return (b.rice_score ?? 0) - (a.rice_score ?? 0)
  })

  const blocked = sorted.filter(i => i.status === 'Blocked' || i.status === 'Paused')
  const done = sorted.filter(i => i.status === 'Done')
  const active = sorted.filter(i => i.status !== 'Blocked' && i.status !== 'Paused' && i.status !== 'Done')

  const bucketed = bucket === 'blocked' ? blocked : bucket === 'done' ? done : active
  const visible = bucketed
    .filter(i => !search || i.project_name.toLowerCase().includes(search.toLowerCase()))
    .filter(i => !ownerFilter || i.owner === ownerFilter)

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
    setSelectedId(prev => (prev === deleteTarget.id ? null : prev))
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
          <>
            <div className="filter-bar">
              <input type="text" placeholder="Search initiatives…" value={search} onChange={e => setSearch(e.target.value)} />
              <select value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)}>
                <option value="">All owners</option>
                {OWNER_VALUES.map(o => <option key={o}>{o}</option>)}
              </select>
              <div className="di-bucket-tabs" style={{ marginLeft: 'auto' }}>
                <button className={`di-bucket-tab${bucket === 'active' ? ' on' : ''}`} onClick={() => setBucket('active')}>
                  Active <b>{active.length}</b>
                </button>
                <button className={`di-bucket-tab${bucket === 'blocked' ? ' on' : ''}${blocked.length ? ' danger' : ''}`} onClick={() => setBucket('blocked')}>
                  Blocked / Paused <b>{blocked.length}</b>
                </button>
                <button className={`di-bucket-tab${bucket === 'done' ? ' on' : ''}`} onClick={() => setBucket('done')}>
                  Done <b>{done.length}</b>
                </button>
              </div>
            </div>

            <div className="di-body">
              <InsightBar initiatives={initiatives} />

              {visible.length === 0 ? (
                <div className="empty">
                  <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></svg>
                  <h3>Nothing here</h3>
                  <p>{bucket === 'active' ? 'Try a different owner, or clear the search.' : 'Nothing in this bucket right now.'}</p>
                </div>
              ) : bucket === 'active' ? (
                <BoardView initiatives={visible} selectedId={selectedId} onSelect={setSelectedId} onStatusChange={handleStatusChange} />
              ) : (
                <FlatList
                  initiatives={visible}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  emptyLabel={bucket === 'blocked' ? 'Nothing blocked or paused.' : 'Nothing done yet.'}
                />
              )}
            </div>
          </>
        )}
      </div>

      {selected && (
        <DIDetailsPanel
          initiative={selected}
          onClose={() => setSelectedId(null)}
          onRefresh={load}
          onEdit={() => setEditTarget(selected)}
          canDelete={canDelete}
          onDelete={() => setDeleteTarget(selected)}
        />
      )}

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
