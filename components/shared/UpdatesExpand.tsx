'use client'

import { useState, useEffect, useCallback } from 'react'
import { Update, TeamMember, Initiative } from '@/types'
import { initials, fmt, fmtRelative, daysClass, daysBetween, parseLinks } from '@/lib/ui'

interface Props {
  initiative: Initiative
  user: { email: string; name: string }
  teamList: TeamMember[]
  onRefresh: () => void
  reloadKey?: number
}

const PARTICIPANT_GRADS = [
  'linear-gradient(135deg,#1A5276,#2980B9)',
  'linear-gradient(135deg,#2980B9,#6B8F71)',
  'linear-gradient(135deg,#6B8F71,#5DADE2)',
  'linear-gradient(135deg,#1A5276,#6B8F71)',
  'linear-gradient(135deg,#5DADE2,#2980B9)',
]

function avatarGrad(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return PARTICIPANT_GRADS[Math.abs(hash) % PARTICIPANT_GRADS.length]
}

export default function UpdatesExpand({ initiative, user, teamList, onRefresh, reloadKey }: Props) {
  const [updates, setUpdates] = useState<Update[]>([])
  const [loading, setLoading] = useState(true)
  const [desc, setDesc] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [waitingOn, setWaitingOn] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [links, setLinks] = useState('')
  const [posting, setPosting] = useState(false)
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  const [showComments, setShowComments] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    const data = await fetch(`/api/initiatives/${initiative.id}/updates`).then(r => r.json())
    setUpdates(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [initiative.id])

  useEffect(() => { load() }, [load, reloadKey])

  async function handleAdd() {
    if (!desc.trim() || !targetDate) return
    setPosting(true)
    const res = await fetch(`/api/initiatives/${initiative.id}/updates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: desc, assigned_to: assignedTo, waiting_on: waitingOn, target_date: targetDate || null, links }),
    })
    const update = await res.json()
    setUpdates(prev => [update, ...prev])
    setDesc(''); setAssignedTo(''); setWaitingOn(''); setTargetDate(''); setLinks('')
    setPosting(false)
    onRefresh()
  }

  async function handleUpdate(updateId: string, fields: Record<string, unknown>) {
    const res = await fetch(`/api/updates/${updateId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    })
    if (!res.ok) return
    const updated = await res.json()
    setUpdates(prev => prev.map(u => u.id === updateId ? { ...u, ...updated } : u))
    onRefresh()
  }

  async function handleComplete(updateId: string) {
    await fetch(`/api/updates/${updateId}/complete`, { method: 'POST' })
    setUpdates(prev => prev.map(u => u.id === updateId ? { ...u, completed: true } : u))
    onRefresh()
  }

  async function handleDelete(updateId: string) {
    await fetch(`/api/updates/${updateId}`, { method: 'DELETE' })
    setUpdates(prev => prev.filter(u => u.id !== updateId))
    onRefresh()
  }

  async function handleComment(updateId: string) {
    const text = commentDrafts[updateId]?.trim()
    if (!text) return
    const res = await fetch(`/api/updates/${updateId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text }),
    })
    const comment = await res.json()
    setUpdates(prev => prev.map(u =>
      u.id === updateId ? { ...u, update_comments: [...((u as any).update_comments ?? []), comment] } : u
    ))
    setCommentDrafts(prev => ({ ...prev, [updateId]: '' }))
  }

  const today = new Date().toISOString().slice(0, 10)
  const active = updates.filter(u => !u.completed)
  const completed = updates.filter(u => u.completed)

  return (
    <div>
      {/* Add form */}
      <div className="milestone-add-form">
        <textarea
          className="milestone-desc-input"
          placeholder="Describe the update, action item, or progress note..."
          value={desc}
          onChange={e => setDesc(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAdd() } }}
          rows={3}
        />
        <div className="milestone-form-row">
          <div className="milestone-form-group">
            <label className="milestone-form-label">ASSIGNED TO</label>
            <select className="milestone-form-select" value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
              <option value="">— None —</option>
              {teamList.map(m => <option key={m.email} value={m.display_name}>{m.display_name}</option>)}
            </select>
          </div>
          <div className="milestone-form-group">
            <label className="milestone-form-label">WAITING ON</label>
            <select className="milestone-form-select" value={waitingOn} onChange={e => setWaitingOn(e.target.value)}>
              <option value="">— None —</option>
              {teamList.map(m => <option key={m.email} value={m.display_name}>{m.display_name}</option>)}
            </select>
          </div>
          <div className="milestone-form-group">
            <label className="milestone-form-label">TARGET DATE <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input type="date" required className="milestone-form-select" value={targetDate} onChange={e => setTargetDate(e.target.value)} />
          </div>
        </div>
        <input
          type="text"
          className="milestone-links-input"
          placeholder="Links (optional, comma-separated)"
          value={links}
          onChange={e => setLinks(e.target.value)}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '.5rem' }}>
          <button
            className="btn btn-grad btn-sm"
            onClick={handleAdd}
            disabled={posting || !desc.trim() || !targetDate}
            title={!targetDate ? 'Set a target date first' : undefined}
          >
            {posting ? '…' : '+ Add'}
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-3)', fontSize: '.78rem' }}>Loading…</div>
      ) : updates.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-3)', fontSize: '.78rem' }}>No milestones yet. Add the first one above.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="milestone-table">
            <thead>
              <tr>
                <th>BY</th>
                <th>UPDATE</th>
                <th>ASSIGNED TO</th>
                <th>WAITING ON</th>
                <th>TARGET DATE</th>
                <th>DAYS LEFT</th>
                <th>DONE</th>
                <th>LINKS</th>
              </tr>
            </thead>
            <tbody>
              {active.map(u => (
                <MilestoneRow
                  key={u.id} u={u} user={user} today={today} teamList={teamList}
                  showComments={showComments} setShowComments={setShowComments}
                  commentDrafts={commentDrafts} setCommentDrafts={setCommentDrafts}
                  onUpdate={handleUpdate} onComplete={handleComplete}
                  onDelete={handleDelete} onComment={handleComment}
                />
              ))}
              {completed.length > 0 && (
                <>
                  <tr className="milestone-divider-row">
                    <td colSpan={8}>
                      <span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 11, height: 11, display: 'inline', verticalAlign: 'middle', marginRight: 4 }}><path d="M20 6L9 17l-5-5" /></svg>
                        COMPLETED
                      </span>
                    </td>
                  </tr>
                  {completed.map(u => (
                    <MilestoneRow
                      key={u.id} u={u} user={user} today={today} teamList={teamList}
                      showComments={showComments} setShowComments={setShowComments}
                      commentDrafts={commentDrafts} setCommentDrafts={setCommentDrafts}
                      onUpdate={handleUpdate} onComplete={handleComplete}
                      onDelete={handleDelete} onComment={handleComment}
                    />
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

interface RowProps {
  u: Update
  user: { email: string; name: string }
  today: string
  teamList: TeamMember[]
  showComments: Set<string>
  setShowComments: React.Dispatch<React.SetStateAction<Set<string>>>
  commentDrafts: Record<string, string>
  setCommentDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>
  onUpdate: (id: string, fields: Record<string, unknown>) => void
  onComplete: (id: string) => void
  onDelete: (id: string) => void
  onComment: (id: string) => void
}

function MilestoneRow({ u, user, today, teamList, showComments, setShowComments, commentDrafts, setCommentDrafts, onUpdate, onComplete, onDelete, onComment }: RowProps) {
  const daysLeft = u.target_date ? daysBetween(today, u.target_date) : null
  const cmts = (u as any).update_comments ?? []
  const hasComments = showComments.has(u.id)
  const rowLinks = u.links ? parseLinks(u.links) : []

  const [editingDesc, setEditingDesc] = useState(false)
  const [draftDesc, setDraftDesc] = useState(u.description)
  const [editingLinks, setEditingLinks] = useState(false)
  const [draftLinks, setDraftLinks] = useState(u.links ?? '')
  const [editingBlockedReason, setEditingBlockedReason] = useState(false)
  const [draftBlockedReason, setDraftBlockedReason] = useState(u.blocked_reason ?? '')

  function saveDesc() {
    setEditingDesc(false)
    if (draftDesc.trim() && draftDesc !== u.description) {
      onUpdate(u.id, { description: draftDesc.trim() })
    } else {
      setDraftDesc(u.description)
    }
  }

  function saveLinks() {
    setEditingLinks(false)
    if (draftLinks !== u.links) {
      onUpdate(u.id, { links: draftLinks })
    }
  }

  function toggleBlocked() {
    if (u.blocked) {
      onUpdate(u.id, { blocked: false, blocked_reason: '' })
      setDraftBlockedReason('')
    } else {
      onUpdate(u.id, { blocked: true })
      setEditingBlockedReason(true)
    }
  }

  function saveBlockedReason() {
    setEditingBlockedReason(false)
    if (draftBlockedReason !== u.blocked_reason) {
      onUpdate(u.id, { blocked_reason: draftBlockedReason })
    }
  }

  return (
    <tr style={{ opacity: u.completed ? .55 : 1 }}>
      {/* BY */}
      <td>
        <div className="milestone-by-cell">
          <div className="milestone-avatar" style={{ background: avatarGrad(u.user_name) }}>
            {initials(u.user_name)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '.7rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1.2, whiteSpace: 'nowrap' }}>{u.user_name}</div>
            <div style={{ fontSize: '.6rem', color: 'var(--text-3)', fontWeight: 500, marginTop: 1, whiteSpace: 'nowrap' }}>{fmtRelative(u.created_at)}</div>
          </div>
        </div>
      </td>

      {/* UPDATE — click to edit */}
      <td style={{ minWidth: 220 }}>
        {editingDesc ? (
          <textarea
            className="milestone-desc-edit"
            value={draftDesc}
            autoFocus
            rows={3}
            onChange={e => setDraftDesc(e.target.value)}
            onBlur={saveDesc}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveDesc() } if (e.key === 'Escape') { setDraftDesc(u.description); setEditingDesc(false) } }}
          />
        ) : (
          <div
            className="milestone-desc-view"
            style={{ textDecoration: u.completed ? 'line-through' : 'none' }}
            onClick={() => { if (!u.completed) { setDraftDesc(u.description); setEditingDesc(true) } }}
            title={u.completed ? undefined : 'Click to edit'}
          >
            {u.description}
          </div>
        )}
        {/* Blocked indicator */}
        {!u.completed && (
          <div style={{ marginTop: '.4rem', display: 'flex', alignItems: 'flex-start', gap: '.4rem', flexWrap: 'wrap' }}>
            <button
              onClick={toggleBlocked}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '.3rem',
                fontSize: '.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.07em',
                padding: '.2rem .5rem', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: u.blocked ? 'rgba(217,79,79,0.12)' : 'rgba(136,153,166,0.1)',
                color: u.blocked ? 'var(--danger)' : 'var(--text-3)',
                transition: 'all .15s',
              }}
              title={u.blocked ? 'Clear blocked status' : 'Mark as blocked by external factor'}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 10, height: 10 }}>
                <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
              </svg>
              {u.blocked ? 'Blocked' : 'Mark Blocked'}
            </button>
            {u.blocked && (
              editingBlockedReason ? (
                <input
                  type="text"
                  className="milestone-inline-input"
                  value={draftBlockedReason}
                  autoFocus
                  placeholder="What is blocking this? (e.g. Waiting on vendor contract)"
                  style={{ flex: 1, minWidth: 180, fontSize: '.72rem' }}
                  onChange={e => setDraftBlockedReason(e.target.value)}
                  onBlur={saveBlockedReason}
                  onKeyDown={e => { if (e.key === 'Enter') saveBlockedReason(); if (e.key === 'Escape') { setDraftBlockedReason(u.blocked_reason ?? ''); setEditingBlockedReason(false) } }}
                />
              ) : (
                <span
                  onClick={() => { setDraftBlockedReason(u.blocked_reason ?? ''); setEditingBlockedReason(true) }}
                  style={{ fontSize: '.72rem', color: '#8a6000', background: '#FFF3E0', padding: '.2rem .5rem', borderRadius: 6, cursor: 'pointer' }}
                  title="Click to edit reason"
                >
                  {u.blocked_reason || <em style={{ color: 'var(--text-3)' }}>No reason set — click to add</em>}
                </span>
              )
            )}
          </div>
        )}

        {/* Comments */}
        {(cmts.length > 0 || hasComments) ? (
          <div className="ut-comments" style={{ marginTop: '.4rem' }}>
            {hasComments && cmts.map((c: any) => (
              <div key={c.id} className="ut-cmt">
                <div className="ut-cmt-avatar">{initials(c.user_name)}</div>
                <div className="ut-cmt-body">
                  <div className="ut-cn">{c.user_name}</div>
                  <div className="ut-ct">{c.content}</div>
                </div>
              </div>
            ))}
            {hasComments && (
              <div className="ut-cmt-compose">
                <input
                  type="text"
                  placeholder="Reply…"
                  value={commentDrafts[u.id] ?? ''}
                  onChange={e => setCommentDrafts(prev => ({ ...prev, [u.id]: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') onComment(u.id) }}
                />
              </div>
            )}
            <button className="ut-cmt-toggle" onClick={() => setShowComments(prev => { const next = new Set(prev); next.has(u.id) ? next.delete(u.id) : next.add(u.id); return next })}>
              {hasComments ? 'Hide' : `${cmts.length} comment${cmts.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        ) : (
          <button className="ut-cmt-toggle" onClick={() => setShowComments(prev => { const next = new Set(prev); next.add(u.id); return next })}>
            Comments
          </button>
        )}
      </td>

      {/* ASSIGNED TO */}
      <td>
        <select
          className="milestone-inline-select"
          value={u.assigned_to ?? ''}
          disabled={u.completed}
          onChange={e => onUpdate(u.id, { assigned_to: e.target.value || '' })}
        >
          <option value="">— None —</option>
          {teamList.map(m => <option key={m.email} value={m.display_name}>{m.display_name}</option>)}
        </select>
      </td>

      {/* WAITING ON */}
      <td>
        <select
          className="milestone-inline-select"
          value={u.waiting_on ?? ''}
          disabled={u.completed}
          onChange={e => onUpdate(u.id, { waiting_on: e.target.value || '' })}
        >
          <option value="">— None —</option>
          {teamList.map(m => <option key={m.email} value={m.display_name}>{m.display_name}</option>)}
        </select>
      </td>

      {/* TARGET DATE */}
      <td style={{ whiteSpace: 'nowrap' }}>
        <input
          type="date"
          className="milestone-inline-input"
          required
          value={u.target_date ? String(u.target_date).slice(0, 10) : ''}
          disabled={u.completed}
          onChange={e => { if (e.target.value) onUpdate(u.id, { target_date: e.target.value }) }}
        />
      </td>

      {/* DAYS LEFT */}
      <td>
        {daysLeft !== null ? (
          <span className={daysClass(daysLeft, u.completed)} style={{ fontSize: '.65rem' }}>
            {u.completed ? '✓' : daysLeft === 0 ? 'Today' : daysLeft > 0 ? `${daysLeft}d` : `${Math.abs(daysLeft)}d over`}
          </span>
        ) : '—'}
      </td>

      {/* DONE */}
      <td>
        <input
          type="checkbox"
          className="done-checkbox"
          checked={!!u.completed}
          onChange={() => { if (!u.completed) onComplete(u.id) }}
          readOnly={u.completed}
        />
      </td>

      {/* LINKS */}
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {editingLinks ? (
            <input
              type="text"
              className="milestone-inline-input"
              value={draftLinks}
              autoFocus
              placeholder="https://…"
              style={{ minWidth: 140 }}
              onChange={e => setDraftLinks(e.target.value)}
              onBlur={saveLinks}
              onKeyDown={e => { if (e.key === 'Enter') saveLinks(); if (e.key === 'Escape') { setDraftLinks(u.links ?? ''); setEditingLinks(false) } }}
            />
          ) : (
            <>
              {rowLinks.length > 0 && (
                <a href={rowLinks[0].startsWith('http') ? rowLinks[0] : `https://${rowLinks[0]}`} target="_blank" rel="noreferrer" title={rowLinks[0]} style={{ color: 'var(--blue-l)', display: 'inline-flex', alignItems: 'center' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                </a>
              )}
              {!u.completed && (
                <button
                  className="icon-btn icon-btn-neutral"
                  style={{ width: 22, height: 22, borderRadius: 5 }}
                  onClick={() => { setDraftLinks(u.links ?? ''); setEditingLinks(true) }}
                  title={rowLinks.length > 0 ? 'Edit link' : 'Add link'}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 10, height: 10 }}>
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              )}
            </>
          )}
          {u.user_email === user.email && (
            <button
              className="icon-btn icon-btn-danger"
              style={{ width: 22, height: 22, borderRadius: 5 }}
              onClick={() => onDelete(u.id)}
              title="Delete"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 10, height: 10 }}>
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              </svg>
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}
