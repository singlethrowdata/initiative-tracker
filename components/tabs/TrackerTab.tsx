'use client'

import { useState, useEffect, useCallback } from 'react'
import { Initiative, TeamMember } from '@/types'
import DetailsPanel from '@/components/details/DetailsPanel'
import CreateInitiativeModal from '@/components/modals/CreateInitiativeModal'
import CompleteModal from '@/components/modals/CompleteModal'
import InitiativeRow from '@/components/shared/InitiativeRow'

interface Props {
  user: { email: string; name: string }
  canDelete: boolean
  teamList: TeamMember[]
}

const STATUSES = ['All', 'Not Started', 'In Progress', 'Blocked', 'Awaiting Approval', 'Approved']
const PRIORITIES = ['All', 'High', 'Medium', 'Low']
const TYPES = ['All', 'Project', 'Process', 'Training', 'Research', 'Other']

export default function TrackerTab({ user, canDelete, teamList }: Props) {
  const [initiatives, setInitiatives] = useState<Initiative[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [priorityFilter, setPriorityFilter] = useState('All')
  const [typeFilter, setTypeFilter] = useState('All')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [completeTarget, setCompleteTarget] = useState<Initiative | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await fetch('/api/initiatives').then(r => r.json())
    setInitiatives(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = initiatives.filter(i => {
    const q = search.toLowerCase()
    const matchSearch = !q || i.task_name.toLowerCase().includes(q) ||
      i.description.toLowerCase().includes(q) || i.department.toLowerCase().includes(q)
    const matchStatus = statusFilter === 'All' || i.status === statusFilter
    const matchPriority = priorityFilter === 'All' || i.priority === priorityFilter
    const matchType = typeFilter === 'All' || i.type === typeFilter
    return matchSearch && matchStatus && matchPriority && matchType
  })

  async function handleStatusChange(id: string, status: string) {
    await fetch(`/api/initiatives/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setInitiatives(prev => prev.map(i => i.id === id ? { ...i, status } : i))
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this initiative? This cannot be undone.')) return
    await fetch(`/api/initiatives/${id}`, { method: 'DELETE' })
    setInitiatives(prev => prev.filter(i => i.id !== id))
  }

  const selected = initiatives.find(i => i.id === selectedId) ?? null

  return (
    <>
      <div className="tracker-wrap">
        <div className="tracker-top">
          <h3>Active Initiatives ({filtered.length})</h3>
          <div className="tracker-top-btns">
            <button className="btn btn-soft btn-sm" onClick={() => window.location.href = '/api/export'}>
              Export CSV
            </button>
            <button className="btn btn-grad btn-sm" onClick={() => setShowCreate(true)}>
              + New Initiative
            </button>
          </div>
        </div>

        <div className="filter-bar">
          <input
            type="text"
            placeholder="Search initiatives…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
            {PRIORITIES.map(p => <option key={p}>{p}</option>)}
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            {TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="loading"><div className="spinner" /><div>Loading…</div></div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></svg>
            <h3>No initiatives found</h3>
            <p>{search ? 'Try a different search.' : 'Create one to get started.'}</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 28 }} />
                <th style={{ width: '22%' }}>Initiative</th>
                <th style={{ width: '10%' }}>Status</th>
                <th style={{ width: '7%' }}>Priority</th>
                <th style={{ width: '8%' }}>Type</th>
                <th style={{ width: '10%' }}>Dept</th>
                <th style={{ width: '12%' }}>Waiting On</th>
                <th style={{ width: '8%' }}>Due</th>
                <th style={{ width: '13%' }}>Description</th>
                <th style={{ width: '10%' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(initiative => (
                <InitiativeRow
                  key={initiative.id}
                  initiative={initiative}
                  user={user}
                  canDelete={canDelete}
                  teamList={teamList}
                  onOpen={() => setSelectedId(initiative.id)}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDelete}
                  onComplete={() => setCompleteTarget(initiative)}
                  onRefresh={load}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedId && (
        <DetailsPanel
          initiativeId={selectedId}
          user={user}
          canDelete={canDelete}
          teamList={teamList}
          onClose={() => setSelectedId(null)}
          onRefresh={load}
        />
      )}

      {showCreate && (
        <CreateInitiativeModal
          user={user}
          teamList={teamList}
          onClose={() => setShowCreate(false)}
          onCreated={i => { setInitiatives(prev => [i, ...prev]); setShowCreate(false) }}
        />
      )}

      {completeTarget && (
        <CompleteModal
          initiative={completeTarget}
          user={user}
          teamList={teamList}
          onClose={() => setCompleteTarget(null)}
          onSubmitted={() => { setCompleteTarget(null); load() }}
        />
      )}
    </>
  )
}
