'use client'

import { useState, useEffect, useCallback } from 'react'
import { PersonalNote, PersonalComment } from '@/types'
import { fmtRelative } from '@/lib/ui'

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

  return (
    <>
      <div className="compose">
        <div className="compose-top">
          <div className="compose-avatar" style={{ fontSize: '.7rem' }}>
            {user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <span>Private note — only visible to you</span>
        </div>
        <input
          type="text"
          placeholder="Note title…"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
        <textarea
          placeholder="Note content…"
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={3}
        />
        <div className="compose-footer">
          <button className="btn btn-grad btn-sm" onClick={handlePost} disabled={posting || !title.trim()}>
            {posting ? 'Saving…' : 'Save Note'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /><div>Loading…</div></div>
      ) : notes.length === 0 ? (
        <div className="empty">
          <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
          <h3>No personal notes</h3>
          <p>Your notes are private and only visible to you.</p>
        </div>
      ) : notes.map(note => {
        const showComments = expandedComments.has(note.id)
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
                <div className="post-title" style={{ marginBottom: '.5rem' }}>{note.title}</div>
                {note.content && <div className="post-body">{note.content}</div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginTop: '.75rem' }}>
                  <span style={{ fontSize: '.7rem', color: 'var(--text-3)' }}>{fmtRelative(note.updated_at)}</span>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '.3rem' }}>
                    <button
                      className="comment-btn"
                      onClick={() => setExpandedComments(prev => {
                        const next = new Set(prev)
                        next.has(note.id) ? next.delete(note.id) : next.add(note.id)
                        return next
                      })}
                    >
                      <svg viewBox="0 0 24 24" style={{ width: 13, height: 13 }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                      {note.personal_comments?.length ?? 0}
                    </button>
                    <button className="btn btn-soft btn-xs" onClick={() => { setEditing(note.id); setEditTitle(note.title); setEditContent(note.content) }}>Edit</button>
                    <button className="btn btn-danger-o btn-xs" onClick={() => handleDelete(note.id)}>Delete</button>
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
                        placeholder="Add a comment…"
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
