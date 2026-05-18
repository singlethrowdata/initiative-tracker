'use client'

import { useState, useEffect, useCallback } from 'react'
import { PersonalNote, PersonalComment } from '@/types'
import { fmtRelative, initials } from '@/lib/ui'

interface Props {
  user: { email: string; name: string }
}

export default function PersonalTab({ user }: Props) {
  const [notes, setNotes] = useState<(PersonalNote & { personal_comments: PersonalComment[] })[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [posting, setPosting] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set())
  const [shared, setShared] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    const data = await fetch('/api/personal').then(r => r.json())
    setNotes(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handlePost() {
    if (!title.trim()) return
    setPosting(true)
    const res = await fetch('/api/personal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content }),
    })
    const note = await res.json()
    setNotes(prev => [{ ...note, personal_comments: [] }, ...prev])
    setTitle(''); setContent('')
    setPosting(false)
  }

  async function handleSaveEdit(id: string) {
    await fetch(`/api/personal/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: editTitle, content: editContent }),
    })
    setNotes(prev => prev.map(n => n.id === id ? { ...n, title: editTitle, content: editContent } : n))
    setEditing(null)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this note?')) return
    await fetch(`/api/personal/${id}`, { method: 'DELETE' })
    setNotes(prev => prev.filter(n => n.id !== id))
  }

  async function handleShareWithTeam(note: PersonalNote) {
    if (!confirm('Share this idea on the Community board? The whole team will see it.')) return
    await fetch('/api/community', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: note.title, content: note.content }),
    })
    setShared(prev => new Set(prev).add(note.id))
  }

  async function handleComment(noteId: string) {
    const text = commentDrafts[noteId]?.trim()
    if (!text) return
    const res = await fetch(`/api/personal/${noteId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text }),
    })
    const comment = await res.json()
    setNotes(prev => prev.map(n =>
      n.id === noteId ? { ...n, personal_comments: [...(n.personal_comments ?? []), comment] } : n
    ))
    setCommentDrafts(prev => ({ ...prev, [noteId]: '' }))
  }

  function handleExport() {
    const rows = [
      ['Title', 'Content', 'Date'],
      ...notes.map(n => [n.title, n.content ?? '', new Date(n.updated_at).toLocaleDateString()])
    ]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'personal-notes.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="compose">
        <div className="compose-top">
          <div className="compose-avatar">{initials(user.name)}</div>
          <span>Capture it before it&apos;s gone</span>
        </div>
        <input
          type="text"
          placeholder="Quick idea, thought, or to-do…"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handlePost() }}
        />
        <textarea
          placeholder="Flesh it out if you want, or just save the spark. Only you can see this."
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={3}
        />
        <div className="compose-footer">
          <span className="compose-tip">Only visible to you</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-soft btn-sm" onClick={handleExport} disabled={notes.length === 0}>
              <svg viewBox="0 0 24 24" style={{ width: 13, height: 13, marginRight: 4 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
              Export
            </button>
            <button className="btn btn-grad btn-sm" onClick={handlePost} disabled={posting || !title.trim()}>
              <svg viewBox="0 0 24 24" style={{ width: 13, height: 13, marginRight: 4 }}><path d="M12 5v14M5 12l7-7 7 7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
              {posting ? 'Saving…' : 'Capture'}
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /><div>Loading…</div></div>
      ) : notes.length === 0 ? (
        <div className="empty">
          <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
          <h3>Nothing captured yet</h3>
          <p>Your ideas are private — only you can see them.</p>
        </div>
      ) : notes.map(note => {
        const showComments = expandedComments.has(note.id)
        const commentCount = note.personal_comments?.length ?? 0
        return (
          <div key={note.id} className="post">
            {editing === note.id ? (
              <>
                <input
                  type="text"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  style={{ width: '100%', fontFamily: 'var(--font)', fontSize: '.9rem', fontWeight: 700, padding: '.5rem .75rem', border: '1.5px solid var(--blue-l)', borderRadius: 10, marginBottom: '.5rem', background: 'var(--bg)' }}
                />
                <textarea
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  rows={4}
                  style={{ width: '100%', fontFamily: 'var(--font)', fontSize: '.85rem', padding: '.5rem .75rem', border: '1.5px solid var(--blue-l)', borderRadius: 10, marginBottom: '.75rem', background: 'var(--bg)', resize: 'vertical' }}
                />
                <div style={{ display: 'flex', gap: '.4rem' }}>
                  <button className="btn btn-grad btn-sm" onClick={() => handleSaveEdit(note.id)}>Save</button>
                  <button className="btn btn-outline btn-sm" onClick={() => setEditing(null)}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <div className="post-title" style={{ marginBottom: note.content ? '.35rem' : '.75rem' }}>{note.title}</div>
                {note.content && <div className="post-body" style={{ marginBottom: '.75rem' }}>{note.content}</div>}
                <div className="personal-note-bar">
                  <span className="personal-note-date">{fmtRelative(note.updated_at)}</span>
                  <div className="personal-note-actions">
                    <button
                      className="comment-btn"
                      onClick={() => setExpandedComments(prev => {
                        const next = new Set(prev)
                        next.has(note.id) ? next.delete(note.id) : next.add(note.id)
                        return next
                      })}
                    >
                      <svg viewBox="0 0 24 24" style={{ width: 13, height: 13 }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                      {commentCount > 0 ? commentCount : 'Notes'}
                    </button>
                    <button
                      className={`btn btn-grad btn-xs${shared.has(note.id) ? ' btn-shared' : ''}`}
                      onClick={() => handleShareWithTeam(note)}
                      disabled={shared.has(note.id)}
                    >
                      <svg viewBox="0 0 24 24" style={{ width: 11, height: 11, marginRight: 3 }}><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
                      {shared.has(note.id) ? 'Shared!' : 'Share with Team'}
                    </button>
                    <button
                      className="btn btn-soft btn-xs"
                      onClick={() => { setEditing(note.id); setEditTitle(note.title); setEditContent(note.content) }}
                    >
                      <svg viewBox="0 0 24 24" style={{ width: 11, height: 11 }}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                      Edit
                    </button>
                    <button className="btn-icon-del" onClick={() => handleDelete(note.id)} title="Delete">
                      <svg viewBox="0 0 24 24" style={{ width: 14, height: 14 }}><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4h6v2" /></svg>
                    </button>
                  </div>
                </div>

                {showComments && (
                  <div className="comments">
                    {(note.personal_comments ?? []).map(c => (
                      <div key={c.id} className="cmt">
                        <div className="cmt-body">
                          <div className="ct">{c.content}</div>
                          <div className="cd">{fmtRelative(c.created_at)}</div>
                        </div>
                      </div>
                    ))}
                    <div className="cmt-compose">
                      <input
                        type="text"
                        placeholder="Add a note…"
                        value={commentDrafts[note.id] ?? ''}
                        onChange={e => setCommentDrafts(prev => ({ ...prev, [note.id]: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') handleComment(note.id) }}
                      />
                      <button className="btn btn-soft btn-sm" onClick={() => handleComment(note.id)}>Add</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )
      })}
    </>
  )
}
