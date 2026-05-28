'use client'

import { useState, useEffect, useCallback } from 'react'
import { Initiative, TeamMember } from '@/types'
import { statusClass, fmt } from '@/lib/ui'
import DetailsPanel from '@/components/details/DetailsPanel'

interface Props {
  user: { email: string; name: string }
  canDelete: boolean
  teamList: TeamMember[]
}

export default function ArchiveTab({ user, canDelete, teamList }: Props) {
  const [initiatives, setInitiatives] = useState<Initiative[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await fetch('/api/archive').then(r => r.json())
    setInitiatives(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = initiatives.filter(i => {
    const q = search.toLowerCase()
    return !q || i.task_name.toLowerCase().includes(q) || i.department.toLowerCase().includes(q)
  })

  async function handleDelete(id: string) {
    if (!confirm('Permanently delete this archived initiative?')) return
    await fetch(`/api/initiatives/${id}`, { method: 'DELETE' })
    setInitiatives(prev => prev.filter(i => i.id !== id))
  }

  return (
    <>
      <div className="tracker-wrap">
        <div className="tracker-top">
          <h3>Archive ({filtered.length})</h3>
          <div className="tracker-top-btns">
            <button className="btn btn-soft btn-sm" onClick={() => window.location.href = '/api/export?archived=true'}>
              Export CSV
            </button>
          </div>
        </div>

        <div className="filter-bar">
          <input
            type="text"
            placeholder="Search archive…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="loading"><div className="spinner" /><div>Loading…</div></div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <svg viewBox="0 0 24 24"><path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" /></svg>
            <h3>Archive is empty</h3>
            <p>Completed and approved initiatives will appear here.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: '24%' }}>Initiative</th>
                <th style={{ width: '9%' }}>Status</th>
                <th style={{ width: '8%' }}>Type</th>
                <th style={{ width: '10%' }}>Dept</th>
                <th style={{ width: '12%' }}>Completed By</th>
                <th style={{ width: '9%' }}>Completed</th>
                <th style={{ width: '18%' }}>Summary</th>
                {canDelete && <th style={{ width: '6%' }} />}
              </tr>
            </thead>
            <tbody>
              {filtered.map(i => (
                <tr key={i.id}>
                  <td>
                    <button className="init-name-link" onClick={() => setSelectedId(i.id)}>
                      {i.task_name}
                    </button>
                    {i.department && <div className="creator-badge">{i.department}</div>}
                  </td>
                  <td>
                    <span className={`pill ${statusClass(i.status)}`}>
                      <span className="d" />{i.status}
                    </span>
                  </td>
                  <td style={{ fontSize: '.72rem' }}>{i.type}</td>
                  <td style={{ fontSize: '.72rem' }}>{i.department}</td>
                  <td style={{ fontSize: '.72rem' }}>{i.completed_by_name || i.completed_by}</td>
                  <td style={{ fontSize: '.72rem' }}>{i.archived_at ? fmt(i.archived_at) : fmt(i.completed_at ?? '')}</td>
                  <td style={{ fontSize: '.72rem', color: 'var(--text-2)', lineHeight: 1.5 }}>
                    {i.completion_desc?.slice(0, 120)}{(i.completion_desc?.length ?? 0) > 120 ? '…' : ''}
                  </td>
                  {canDelete && (
                    <td>
                      <button className="btn btn-danger-o btn-xs" onClick={() => handleDelete(i.id)}>Delete</button>
                    </td>
                  )}
                </tr>
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
          onComplete={() => {}}
        />
      )}
    </>
  )
}
