'use client'

import { useState, useEffect, useCallback } from 'react'
import { Update, TeamMember, Initiative } from '@/types'
import { initials, fmt, fmtRelative, daysClass, daysBetween } from '@/lib/ui'

interface Props {
  initiative: Initiative
  user: { email: string; name: string }
  teamList: TeamMember[]
  onRefresh: () => void
}

export default function UpdatesExpand({ initiative, user, teamList, onRefresh }: Props) {
  const [updates, setUpdates] = useState<Update[]>([])
  const [loading, setLoading] = useState(true)
  const [desc, setDesc] = useState('')
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

  useEffect(() => { load() }, [load])

  async function handleAdd() {
    if (!desc.trim()) return
    setPosting(true)
    const res = await fetch(`/api/initiatives/${initiative.id}/updates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: desc, waiting_on: waitingOn, target_date: targetDate || null, links }),
    })
    const update = await res.json()
    setUpdates(prev => [update, ...prev])
    setDesc(''); setWaitingOn(''); setTargetDate(''); setLinks('')
    setPosting(false)
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

  return (
    <div>
      <h4 style={{ fontSize: '.72rem', fontWeight: 800, marginBottom: '.75rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
        Updates
      </h4>

      <table className="update-table">
        <thead>
          <tr>
            <th style={{ width: '35%' }}>Description</th>
            <th style={{ width: '12%' }}>Waiting On</th>
            <th style={{ width: '8%' }}>Target</th>
            <th style={{ width: '10%' }}>By</th>
            <th style={{ width: '8%' }}>Status</th>
            <th style={{ width: '10%' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={6} style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-3)' }}>Loading…</td></tr>
          ) : updates.length === 0 ? (
            <tr><td colSpan={6} style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-3)', fontSize: '.78rem' }}>No updates yet.</td></tr>
          ) : updates.map(u => {
            const daysLeft = u.target_date ? daysBetween(today, u.target_date) : null
            const cmts = (u as any).update_comments ?? []
            const hasComments = showComments.has(u.id)

            return (
              <tr key={u.id} style={{ opacity: u.completed ? .55 : 1 }}>
                <td className="ut-desc">
                  <div style={{ textDecoration: u.completed ? 'line-through' : 'none' }}>{u.description}</div>
                  <div className="ut-meta">{u.user_name} · {fmtRelative(u.created_at)}</div>
                  {cmts.length > 0 || hasComments ? (
                    <div className="ut-comments">
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
                            onKeyDown={e => { if (e.key === 'Enter') handleComment(u.id) }}
                          />
                        </div>
                      )}
                      <button
                        className="ut-cmt-toggle"
                        onClick={() => setShowComments(prev => {
                          const next = new Set(prev); next.has(u.id) ? next.delete(u.id) : next.add(u.id); return next
                        })}
                      >
                        {hasComments ? 'Hide' : `${cmts.length} comment${cmts.length !== 1 ? 's' : ''}`}
                      </button>
                    </div>
                  ) : (
                    <button
                      className="ut-cmt-toggle"
                      onClick={() => setShowComments(prev => { const next = new Set(prev); next.add(u.id); return next })}
                    >
                      + Comment
                    </button>
                  )}
                </td>
                <td>
                  {u.waiting_on ? <span className="ut-waiting-chip">{u.waiting_on}</span> : '—'}
                </td>
                <td>
                  {u.target_date ? (
                    <span className={daysClass(daysLeft ?? 0, u.completed)}>
                      {u.completed ? fmt(u.target_date) : daysLeft === 0 ? 'Today' : daysLeft! > 0 ? `${daysLeft}d left` : `${Math.abs(daysLeft!)}d over`}
                    </span>
                  ) : '—'}
                </td>
                <td style={{ fontSize: '.68rem' }}>{u.user_name}</td>
                <td>
                  <span className={u.completed ? 'pill s-complete' : 'pill s-active'} style={{ fontSize: '.62rem' }}>
                    <span className="d" />{u.completed ? 'Done' : 'Open'}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {!u.completed && (
                      <button className="btn btn-green btn-xs" onClick={() => handleComplete(u.id)}>Done</button>
                    )}
                    {(u.user_email === user.email) && (
                      <button className="btn btn-danger-o btn-xs" onClick={() => handleDelete(u.id)}>Del</button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr>
            <td>
              <input
                className="auto-grow"
                placeholder="Add an update…"
                value={desc}
                onChange={e => setDesc(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAdd() } }}
              />
            </td>
            <td>
              <select
                className="inline-wait-select"
                value={waitingOn}
                onChange={e => setWaitingOn(e.target.value)}
              >
                <option value="">— None —</option>
                {teamList.map(m => <option key={m.email} value={m.display_name}>{m.display_name}</option>)}
              </select>
            </td>
            <td>
              <input
                type="date"
                value={targetDate}
                onChange={e => setTargetDate(e.target.value)}
                style={{ fontFamily: 'var(--font)', fontSize: '.68rem', border: '1px solid var(--border)', borderRadius: 6, padding: '.2rem .4rem', background: 'var(--bg)', color: 'var(--text)' }}
              />
            </td>
            <td colSpan={2}>
              <input
                type="text"
                placeholder="Links"
                value={links}
                onChange={e => setLinks(e.target.value)}
                style={{ width: '100%', fontFamily: 'var(--font)', fontSize: '.68rem', border: '1px solid var(--border)', borderRadius: 6, padding: '.2rem .4rem', background: 'var(--bg)', color: 'var(--text)' }}
              />
            </td>
            <td>
              <button className="btn btn-soft btn-xs" onClick={handleAdd} disabled={posting || !desc.trim()}>
                {posting ? '…' : 'Add'}
              </button>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
