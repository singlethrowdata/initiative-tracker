'use client'

import { useState, useEffect, useCallback } from 'react'
import { DiInitiative, TeamMember } from '@/types'
import { STATUS_VALUES, TIER_VALUES, OWNER_VALUES, PRIORITY_VALUES, currentStageDays } from '@/lib/di-scheduling'
import { fmt, diStatusClass, priorityClass, stageAgeClass } from '@/lib/ui'
import StageTimelineBar from '@/components/tabs/di/StageTimelineBar'
import CapacitySummary from '@/components/tabs/di/CapacitySummary'
import FlowMetrics from '@/components/tabs/di/FlowMetrics'
import KpiStrip from '@/components/tabs/di/KpiStrip'
import CreateDIInitiativeModal from '@/components/modals/CreateDIInitiativeModal'
import EditDIInitiativeModal from '@/components/modals/EditDIInitiativeModal'
import DIDetailsPanel from '@/components/details/DIDetailsPanel'
import ConfirmModal from '@/components/modals/ConfirmModal'

interface Props {
  user: { email: string; name: string }
  canDelete: boolean
  teamList: TeamMember[]
}

export default function DIRoadmapTab({ canDelete }: Props) {
  const [initiatives, setInitiatives] = useState<DiInitiative[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'capacity' | 'flow'>('list')
  const [config, setConfig] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [ownerFilter, setOwnerFilter] = useState('All')
  const [tierFilter, setTierFilter] = useState('All')
  const [priorityFilter, setPriorityFilter] = useState('All')
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
  useEffect(() => { fetch('/api/di-config').then(r => r.json()).then(setConfig) }, [])

  const stageWarnDays = Number(config.stage_warn_days ?? 5)
  const stageAlertDays = Number(config.stage_alert_days ?? 10)

  const filtered = initiatives.filter(i => {
    const q = search.toLowerCase()
    const matchSearch = !q || i.project_name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q)
    const matchStatus = statusFilter === 'All' || i.status === statusFilter
    const matchOwner = ownerFilter === 'All' || i.owner === ownerFilter
    const matchTier = tierFilter === 'All' || i.tier === tierFilter
    const matchPriority = priorityFilter === 'All' || i.priority === priorityFilter
    return matchSearch && matchStatus && matchOwner && matchTier && matchPriority
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

  return (
    <>
      <div className="tracker-wrap">
        <div className="tracker-top">
          <h3>D+I Roadmap</h3>
          <div className="tracker-top-btns">
            <button
              className={`btn btn-sm ${view === 'list' ? 'btn-grad' : 'btn-outline'}`}
              onClick={() => setView('list')}
            >
              List
            </button>
            <button
              className={`btn btn-sm ${view === 'capacity' ? 'btn-grad' : 'btn-outline'}`}
              onClick={() => setView('capacity')}
            >
              Capacity
            </button>
            <button
              className={`btn btn-sm ${view === 'flow' ? 'btn-grad' : 'btn-outline'}`}
              onClick={() => setView('flow')}
            >
              Flow
            </button>
            <button className="btn btn-grad btn-sm" onClick={() => setShowCreate(true)}>
              + Add Initiative
            </button>
          </div>
        </div>

        {!loading && <KpiStrip initiatives={initiatives} stageWarnDays={stageWarnDays} />}

        {view === 'capacity' ? (
          loading ? (
            <div className="loading"><div className="spinner" /><div>Loading…</div></div>
          ) : (
            <CapacitySummary initiatives={initiatives} />
          )
        ) : view === 'flow' ? (
          <FlowMetrics />
        ) : (
          <>
            <div className="filter-bar">
              <input
                type="text"
                placeholder="Search D+I initiatives…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="All">All Statuses</option>
                {STATUS_VALUES.map(s => <option key={s}>{s}</option>)}
              </select>
              <select value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)}>
                <option value="All">All Owners</option>
                {OWNER_VALUES.map(o => <option key={o}>{o}</option>)}
              </select>
              <select value={tierFilter} onChange={e => setTierFilter(e.target.value)}>
                <option value="All">All Tiers</option>
                {TIER_VALUES.map(t => <option key={t}>{t}</option>)}
              </select>
              <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
                <option value="All">All Priorities</option>
                {PRIORITY_VALUES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>

            {loading ? (
              <div className="loading"><div className="spinner" /><div>Loading…</div></div>
            ) : filtered.length === 0 ? (
              <div className="empty">
                <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></svg>
                <h3>No D+I initiatives found</h3>
                <p>{search ? 'Try a different search.' : 'Create one to get started.'}</p>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '5%' }}>P#</th>
                    <th style={{ width: '16%' }}>Project</th>
                    <th style={{ width: '8%' }}>Priority</th>
                    <th style={{ width: '9%' }}>Status</th>
                    <th style={{ width: '9%' }}>Owner</th>
                    <th style={{ width: '16%' }}>Stage Timeline</th>
                    <th style={{ width: '7%' }}>Days</th>
                    <th style={{ width: '9%' }}>Deploy Target</th>
                    <th style={{ width: '6%' }}>RICE</th>
                    <th style={{ width: '9%' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(i => (
                    <tr key={i.id}>
                      <td>{i.queue_number ?? '—'}</td>
                      <td>
                        <a className="init-name-link" style={{ cursor: 'pointer' }} onClick={() => setSelectedId(i.id)}>
                          {i.project_name}
                        </a>
                      </td>
                      <td><span className={priorityClass(i.priority)}>{i.priority}</span></td>
                      <td>
                        <select
                          className={`inline-select pill ${diStatusClass(i.status)}`}
                          value={i.status}
                          onChange={e => handleStatusChange(i.id, e.target.value)}
                        >
                          {STATUS_VALUES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td>{i.owner || '—'}</td>
                      <td><StageTimelineBar history={i.history} /></td>
                      <td>
                        {(() => {
                          const days = currentStageDays(i.history)
                          if (days == null) return '—'
                          return <span className={stageAgeClass(days, stageWarnDays, stageAlertDays)}>{Math.round(days)}d</span>
                        })()}
                      </td>
                      <td>
                        {i.deploy_target ? fmt(i.deploy_target) : '—'}
                        {i.overdue && <span style={{ color: '#C0392B', fontWeight: 700, marginLeft: 4 }}>⚠</span>}
                      </td>
                      <td>{i.rice_score != null ? i.rice_score.toFixed(1) : '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '.3rem' }}>
                          <button className="icon-btn icon-btn-neutral" onClick={() => setEditTarget(i)} title="Edit">
                            <svg viewBox="0 0 24 24" style={{ width: 13, height: 13 }}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                          </button>
                          {canDelete && (
                            <button className="icon-btn" onClick={() => setDeleteTarget(i)} title="Delete">
                              <svg viewBox="0 0 24 24" style={{ width: 13, height: 13 }}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" /></svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>

      {selectedId && (
        <DIDetailsPanel
          initiativeId={selectedId}
          onClose={() => setSelectedId(null)}
          onRefresh={load}
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
