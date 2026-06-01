'use client'

import { useState, useEffect } from 'react'
import { Initiative, TeamMember, InitiativeNote, NoteComment } from '@/types'
import { fmt, fmtRelative, initials, statusClass, priorityClass, parseLinks, daysBetween } from '@/lib/ui'
import UpdatesExpand from '@/components/shared/UpdatesExpand'
import EditInitiativeModal from '@/components/modals/EditInitiativeModal'
import MeetingAnalysisModal from '@/components/modals/MeetingAnalysisModal'

interface Props {
  initiativeId: string
  user: { email: string; name: string }
  canDelete: boolean
  teamList: TeamMember[]
  onClose: () => void
  onRefresh: () => void
  onComplete: () => void
}

const PARTICIPANT_GRADS = [
  'linear-gradient(135deg,#1A5276,#2980B9)',
  'linear-gradient(135deg,#2980B9,#6B8F71)',
  'linear-gradient(135deg,#6B8F71,#5DADE2)',
  'linear-gradient(135deg,#1A5276,#6B8F71)',
  'linear-gradient(135deg,#5DADE2,#2980B9)',
]

export default function DetailsPanel({ initiativeId, user, teamList, onClose, onRefresh, onComplete }: Props) {
  const [initiative, setInitiative] = useState<Initiative | null>(null)
  const [notes, setNotes] = useState<InitiativeNote[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')
  const [noteEditId, setNoteEditId] = useState<string | null>(null)
  const [noteEditDraft, setNoteEditDraft] = useState('')
  const [posting, setPosting] = useState(false)
  const [linkTitle, setLinkTitle] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [noteCommentDrafts, setNoteCommentDrafts] = useState<Record<string, string>>({})
  const [showNoteComments, setShowNoteComments] = useState<Set<string>>(new Set())
  const [editingComment, setEditingComment] = useState<{ id: string; noteId: string; draft: string } | null>(null)
  const [showEdit, setShowEdit] = useState(false)
  const [showAnalysis, setShowAnalysis] = useState(false)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    fetch(`/api/initiatives/${initiativeId}`)
      .then(r => r.json())
      .then(data => {
        setInitiative(data.initiative)
        setNotes(data.notes ?? [])
        setLoading(false)
        requestAnimationFrame(() => setOpen(true))
      })
  }, [initiativeId])

  function handleClose() {
    setOpen(false)
    setTimeout(onClose, 400)
  }

  async function handleNotePost() {
    if (!noteDraft.trim()) return
    setPosting(true)
    const res = await fetch(`/api/initiatives/${initiativeId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: noteDraft }),
    })
    const note = await res.json()
    setNotes(prev => [note, ...prev])
    setNoteDraft('')
    setPosting(false)
  }

  async function handleNoteDelete(noteId: string) {
    await fetch(`/api/initiatives/${initiativeId}/notes/${noteId}`, { method: 'DELETE' })
    setNotes(prev => prev.filter(n => n.id !== noteId))
  }

  async function handleNoteEdit(noteId: string) {
    if (!noteEditDraft.trim()) return
    const res = await fetch(`/api/initiatives/${initiativeId}/notes/${noteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: noteEditDraft }),
    })
    const updated = await res.json()
    setNotes(prev => prev.map(n => n.id === noteId ? updated : n))
    setNoteEditId(null)
    setNoteEditDraft('')
  }

  async function handleNoteComment(noteId: string) {
    const text = noteCommentDrafts[noteId]?.trim()
    if (!text) return
    const res = await fetch(`/api/initiatives/${initiativeId}/notes/${noteId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text }),
    })
    const comment: NoteComment = await res.json()
    setNotes(prev => prev.map(n =>
      n.id === noteId ? { ...n, note_comments: [...(n.note_comments ?? []), comment] } : n
    ))
    setNoteCommentDrafts(prev => ({ ...prev, [noteId]: '' }))
  }

  async function handleCommentEdit(noteId: string, commentId: string, content: string) {
    const res = await fetch(`/api/initiatives/${initiativeId}/notes/${noteId}/comments/${commentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
    const updated = await res.json()
    setNotes(prev => prev.map(n =>
      n.id === noteId
        ? { ...n, note_comments: n.note_comments.map(c => c.id === commentId ? updated : c) }
        : n
    ))
    setEditingComment(null)
  }

  async function handleCommentDelete(noteId: string, commentId: string) {
    await fetch(`/api/initiatives/${initiativeId}/notes/${noteId}/comments/${commentId}`, { method: 'DELETE' })
    setNotes(prev => prev.map(n =>
      n.id === noteId
        ? { ...n, note_comments: n.note_comments.filter(c => c.id !== commentId) }
        : n
    ))
  }

  async function handleLinkAdd() {
    if (!linkUrl.trim()) return
    const existing = initiative?.links ?? ''
    const newEntry = linkTitle.trim() ? `${linkTitle.trim()} ${linkUrl.trim()}` : linkUrl.trim()
    const updated = existing ? `${existing},${newEntry}` : newEntry
    await fetch(`/api/initiatives/${initiativeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ links: updated }),
    })
    setInitiative(prev => prev ? { ...prev, links: updated } : prev)
    setLinkTitle('')
    setLinkUrl('')
    onRefresh()
  }

  async function handleLinkDelete(index: number) {
    const existing = parseLinks(initiative?.links ?? '')
    existing.splice(index, 1)
    const updated = existing.join(',')
    await fetch(`/api/initiatives/${initiativeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ links: updated }),
    })
    setInitiative(prev => prev ? { ...prev, links: updated } : prev)
    onRefresh()
  }

  const links = parseLinks(initiative?.links ?? '')
  const completionLinks = parseLinks(initiative?.completion_links ?? '')
  const participants = initiative?.participants
    ? initiative.participants.split(',').map(p => p.trim()).filter(Boolean)
    : []

  // Progress calculation
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  let progressPct = 0
  let daysElapsed = 0
  let daysRemaining = 0
  let isOverdue = false

  if (initiative?.start_date && initiative?.anticipated_end_date) {
    const start = new Date(initiative.start_date)
    const end = new Date(initiative.anticipated_end_date)
    const totalDays = Math.max(daysBetween(initiative.start_date, initiative.anticipated_end_date), 1)
    daysElapsed = Math.max(0, daysBetween(initiative.start_date, todayStr))
    progressPct = Math.min(100, Math.round((daysElapsed / totalDays) * 100))
    daysRemaining = daysBetween(todayStr, initiative.anticipated_end_date)
    isOverdue = daysRemaining < 0
  }

  return (
    <div className={`details-panel${open ? ' open' : ''}`}>
      {/* Nav */}
      <nav className="details-nav">
        <div className="details-nav-left">
          <button className="details-back" onClick={handleClose}>
            <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" /></svg>
            Back
          </button>
          {initiative && (
            <div className="details-crumb">
              Tracker / <span>{initiative.task_name}</span>
            </div>
          )}
        </div>
        {initiative && (
          <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
            {initiative.status !== 'Awaiting Approval' && initiative.status !== 'Approved' && initiative.status !== 'Completed' && (
              <button className="btn btn-grad btn-sm" onClick={onComplete}>
                <svg viewBox="0 0 24 24" style={{ width: 13, height: 13 }}><path d="M20 6L9 17l-5-5" /></svg>
                Complete
              </button>
            )}
            <button className="btn btn-soft btn-sm" onClick={() => setShowAnalysis(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Analyze Meeting
            </button>
            <button className="btn btn-soft btn-sm" onClick={() => setShowEdit(true)}>
              <svg viewBox="0 0 24 24" style={{ width: 13, height: 13 }}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
              Edit
            </button>
          </div>
        )}
      </nav>

      {loading ? (
        <div className="loading"><div className="spinner" /><div>Loading…</div></div>
      ) : initiative ? (
        <div className="details-body">

          {/* Hero card */}
          <div className="dp-hero-card">
            <div className="dp-hero-left">
              <div className="dp-hero-st-logo">
                <img src="/ICONSTM_White.png" alt="Single Throw" style={{ width: 48, height: 48, objectFit: 'contain' }} />
              </div>
              <div className="dp-hero-st-label">SINGLE THROW</div>
              <div className="dp-hero-type-badge">{initiative.type}</div>
            </div>
            <div className="dp-hero-right">
              <div className="dp-hero-title">{initiative.task_name}</div>
              <div className="dp-hero-meta">
                <span className={`pill ${statusClass(initiative.status)}`} style={{ fontSize: '.7rem' }}>
                  <span className="d" />{initiative.status}
                </span>
                <span className={priorityClass(initiative.priority)} style={{ fontWeight: 700, fontSize: '.72rem' }}>
                  {initiative.priority}
                </span>
                <span style={{ fontSize: '.72rem', color: 'var(--text-3)' }}>
                  by {initiative.created_by_name} · Created {fmtRelative(initiative.created_at)}
                </span>
              </div>
              <div className="dp-date-boxes">
                <div className="dp-date-box">
                  <div className="dp-date-box-label">START DATE</div>
                  <div className="dp-date-box-value">{initiative.start_date ? fmt(initiative.start_date) : '—'}</div>
                </div>
                <div className="dp-date-box">
                  <div className="dp-date-box-label">TARGET END</div>
                  <div className="dp-date-box-value">{initiative.anticipated_end_date ? fmt(initiative.anticipated_end_date) : '—'}</div>
                </div>
              </div>
              {participants.length > 0 && (
                <div>
                  <div className="dp-section-label" style={{ marginBottom: '.5rem' }}>PARTICIPANTS</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem' }}>
                    {participants.map((name, i) => (
                      <div key={i} className="dp-participant-chip">
                        <div className="dp-participant-avatar" style={{ background: PARTICIPANT_GRADS[i % PARTICIPANT_GRADS.length] }}>
                          {initials(name)}
                        </div>
                        <span>{name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Awaiting Approval banner */}
          {initiative.status === 'Awaiting Approval' && (
            <div className="dp-approved-banner" style={{ background: 'rgba(249,200,75,0.12)', borderColor: '#D4920A' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#D4920A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18, flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div style={{ color: '#8a6000' }}>
                <strong>Awaiting Approval</strong> — This initiative has been submitted for completion and is pending leadership review.
              </div>
            </div>
          )}

          {/* Approved banner */}
          {(initiative.status === 'Approved' || initiative.status === 'Completed') && (
            <div className="dp-approved-banner">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18, flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" />
                <path d="M9 12l2 2 4-4" />
              </svg>
              <div>
                <strong>Completed</strong> — This initiative has been approved and is archived.
              </div>
            </div>
          )}

          {/* Description */}
          <div className="dp-section-card">
            <div className="dp-section-label">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
              </svg>
              DESCRIPTION
            </div>
            <p style={{ fontSize: '.88rem', color: 'var(--text-2)', lineHeight: 1.8, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {initiative.description || <span style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>No description provided.</span>}
            </p>
          </div>

          {/* Notes section */}
          <div className="dp-section-card">
            <div className="dp-section-label">
              NOTES
            </div>
            <div style={{ marginBottom: '1rem' }}>
              {notes.length === 0 ? (
                <p style={{ color: 'var(--text-3)', fontSize: '.78rem' }}>No notes yet.</p>
              ) : notes.map(n => (
                <div key={n.id} className="dp-note-row">
                  {noteEditId === n.id ? (
                    <div style={{ flex: 1 }}>
                      <textarea
                        className="dp-note-textarea"
                        value={noteEditDraft}
                        onChange={e => setNoteEditDraft(e.target.value)}
                        rows={3}
                      />
                      <div style={{ display: 'flex', gap: '.4rem', marginTop: '.4rem' }}>
                        <button className="btn btn-grad btn-xs" onClick={() => handleNoteEdit(n.id)}>Save</button>
                        <button className="btn btn-soft btn-xs" onClick={() => setNoteEditId(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.5rem' }}>
                          <div className="dp-participant-avatar" style={{ width: 24, height: 24, fontSize: '.48rem', background: PARTICIPANT_GRADS[0], flexShrink: 0 }}>
                            {initials(n.user_name)}
                          </div>
                          <span style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--text)' }}>{n.user_name}</span>
                          <span style={{ fontSize: '.63rem', color: 'var(--text-3)' }}>{fmtRelative(n.created_at)}</span>
                        </div>
                        <div style={{ fontSize: '.84rem', color: 'var(--text-2)', lineHeight: 1.65, marginBottom: '.5rem' }}>{n.content}</div>
                        {/* Comments */}
                        <div className="ut-comments">
                          {showNoteComments.has(n.id) && (n.note_comments ?? []).map((c: NoteComment) => (
                            <div key={c.id} className="ut-cmt">
                              <div className="ut-cmt-avatar">{initials(c.user_name)}</div>
                              <div className="ut-cmt-body" style={{ flex: 1 }}>
                                <div className="ut-cn">{c.user_name}</div>
                                {editingComment?.id === c.id ? (
                                  <div style={{ display: 'flex', gap: '.4rem', marginTop: '.3rem' }}>
                                    <input
                                      type="text"
                                      value={editingComment.draft}
                                      onChange={e => setEditingComment(prev => prev ? { ...prev, draft: e.target.value } : prev)}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') handleCommentEdit(n.id, c.id, editingComment.draft)
                                        if (e.key === 'Escape') setEditingComment(null)
                                      }}
                                      style={{ flex: 1, fontSize: '.78rem' }}
                                      autoFocus
                                    />
                                    <button className="btn btn-grad btn-xs" onClick={() => handleCommentEdit(n.id, c.id, editingComment.draft)}>Save</button>
                                    <button className="btn btn-soft btn-xs" onClick={() => setEditingComment(null)}>Cancel</button>
                                  </div>
                                ) : (
                                  <div className="ut-ct">{c.content}</div>
                                )}
                              </div>
                              {c.user_email === user.email && editingComment?.id !== c.id && (
                                <div style={{ display: 'flex', gap: '.25rem', flexShrink: 0 }}>
                                  <button
                                    className="icon-btn icon-btn-neutral"
                                    style={{ width: 22, height: 22, borderRadius: 5 }}
                                    onClick={() => setEditingComment({ id: c.id, noteId: n.id, draft: c.content })}
                                    title="Edit"
                                  >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 10, height: 10 }}>
                                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                    </svg>
                                  </button>
                                  <button
                                    className="icon-btn icon-btn-danger"
                                    style={{ width: 22, height: 22, borderRadius: 5 }}
                                    onClick={() => handleCommentDelete(n.id, c.id)}
                                    title="Delete"
                                  >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 10, height: 10 }}>
                                      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                    </svg>
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                          {showNoteComments.has(n.id) && (
                            <div className="ut-cmt-compose">
                              <input
                                type="text"
                                placeholder="Reply…"
                                value={noteCommentDrafts[n.id] ?? ''}
                                onChange={e => setNoteCommentDrafts(prev => ({ ...prev, [n.id]: e.target.value }))}
                                onKeyDown={e => { if (e.key === 'Enter') handleNoteComment(n.id) }}
                              />
                            </div>
                          )}
                          <button
                            className="ut-cmt-toggle"
                            onClick={() => setShowNoteComments(prev => {
                              const next = new Set(prev); next.has(n.id) ? next.delete(n.id) : next.add(n.id); return next
                            })}
                          >
                            {showNoteComments.has(n.id) ? 'Hide' : (n.note_comments?.length ?? 0) > 0 ? `${n.note_comments.length} comment${n.note_comments.length !== 1 ? 's' : ''}` : 'Comment'}
                          </button>
                        </div>
                      </div>
                      {n.user_email === user.email && (
                        <div style={{ display: 'flex', gap: '.3rem', flexShrink: 0 }}>
                          <button
                            className="icon-btn icon-btn-neutral"
                            style={{ width: 26, height: 26, borderRadius: 6 }}
                            onClick={() => { setNoteEditId(n.id); setNoteEditDraft(n.content) }}
                            title="Edit"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button
                            className="icon-btn icon-btn-danger"
                            style={{ width: 26, height: 26, borderRadius: 6 }}
                            onClick={() => handleNoteDelete(n.id)}
                            title="Delete"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
                              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
            <textarea
              className="dp-note-textarea"
              placeholder="Add a note..."
              value={noteDraft}
              onChange={e => setNoteDraft(e.target.value)}
              rows={3}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '.5rem' }}>
              <button className="btn btn-grad btn-sm" onClick={handleNotePost} disabled={posting || !noteDraft.trim()}>
                {posting ? '…' : '+ Add Note'}
              </button>
            </div>
          </div>

          {/* Links section */}
          <div className="dp-section-card">
            <div className="dp-section-label">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              LINKS
            </div>
            {links.map((url, i) => (
              <div key={i} className="dp-link-row">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13, flexShrink: 0, color: 'var(--blue-l)' }}>
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                <a href={url.startsWith('http') ? url : `https://${url}`} target="_blank" rel="noreferrer" style={{ flex: 1, fontSize: '.78rem', color: 'var(--blue-l)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {url}
                </a>
                <button
                  className="icon-btn icon-btn-danger"
                  style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0 }}
                  onClick={() => handleLinkDelete(i)}
                  title="Delete"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 11, height: 11 }}>
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  </svg>
                </button>
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem', marginTop: links.length > 0 ? '.75rem' : 0 }}>
              <input
                type="text"
                placeholder="Title (e.g. SOP Doc)"
                value={linkTitle}
                onChange={e => setLinkTitle(e.target.value)}
                className="dp-field-input"
              />
              <input
                type="text"
                placeholder="Paste a URL..."
                value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleLinkAdd() }}
                className="dp-field-input"
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '.5rem' }}>
              <button className="btn btn-grad btn-sm" onClick={handleLinkAdd} disabled={!linkUrl.trim()}>
                + Add
              </button>
            </div>
          </div>

          {/* Progress section */}
          {initiative.start_date && initiative.anticipated_end_date && (
            <div className="dp-section-card" style={{ position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '.75rem' }}>
                <div className="dp-section-label" style={{ marginBottom: 0 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                  </svg>
                  Progress
                </div>
                <div style={{ display: 'flex', gap: '1.25rem' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '.55rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-3)' }}>START</div>
                    <div style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--text)' }}>{fmt(initiative.start_date)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '.55rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-3)' }}>TARGET END</div>
                    <div style={{ fontSize: '.72rem', fontWeight: 700, color: isOverdue ? 'var(--danger)' : 'var(--text)' }}>{fmt(initiative.anticipated_end_date)}</div>
                  </div>
                </div>
              </div>
              <div className="dp-progress-bar-wrap">
                <div
                  className="dp-progress-bar-fill"
                  style={{
                    width: `${progressPct}%`,
                    background: progressPct >= 100 ? 'var(--danger)' : 'linear-gradient(90deg,#D94F4F,#E67E22)',
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '.4rem' }}>
                <span style={{ fontSize: '.7rem', color: 'var(--text-3)', fontWeight: 600 }}>{progressPct}% elapsed</span>
                {isOverdue ? (
                  <span style={{ fontSize: '.7rem', color: 'var(--danger)', fontWeight: 700 }}>{Math.abs(daysRemaining)}d overdue</span>
                ) : (
                  <span style={{ fontSize: '.7rem', color: 'var(--text-3)', fontWeight: 600 }}>{daysRemaining}d remaining</span>
                )}
              </div>
            </div>
          )}

          {/* Completion block */}
          {initiative.is_archived && initiative.completion_desc && (
            <div className="dp-section-card" style={{ borderLeft: '3px solid var(--green)' }}>
              <div className="dp-section-label" style={{ color: 'var(--green)' }}>Completion Summary</div>
              <p style={{ fontSize: '.88rem', color: 'var(--text-2)', lineHeight: 1.8, whiteSpace: 'pre-wrap', marginTop: '.5rem' }}>
                {initiative.completion_desc}
              </p>
              {initiative.sop_link && (
                <div style={{ marginTop: '.5rem' }}>
                  <a href={initiative.sop_link} target="_blank" rel="noreferrer" className="link-chip">
                    ↗ SOP / Documentation
                  </a>
                </div>
              )}
              {completionLinks.length > 0 && (
                <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', marginTop: '.5rem' }}>
                  {completionLinks.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noreferrer" className="link-chip">
                      ↗ {url.replace(/^https?:\/\//, '').slice(0, 40)}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Milestones / Updates section */}
          <div className="dp-section-card">
            <div className="dp-section-label">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Milestones
            </div>
            <UpdatesExpand
              initiative={initiative}
              user={user}
              teamList={teamList}
              onRefresh={onRefresh}
            />
          </div>

        </div>
      ) : (
        <div className="empty">
          <h3>Initiative not found</h3>
        </div>
      )}

      {showEdit && initiative && (
        <EditInitiativeModal
          initiative={initiative}
          teamList={teamList}
          onClose={() => setShowEdit(false)}
          onSaved={() => {
              setShowEdit(false)
              fetch(`/api/initiatives/${initiativeId}`)
                .then(r => r.json())
                .then(data => { setInitiative(data.initiative); setNotes(data.notes ?? []) })
              onRefresh()
            }}
        />
      )}

      {showAnalysis && initiative && (
        <MeetingAnalysisModal
          initiativeId={initiativeId}
          initiativeName={initiative.task_name}
          teamList={teamList}
          onClose={() => setShowAnalysis(false)}
          onApplied={() => {
            setShowAnalysis(false)
            fetch(`/api/initiatives/${initiativeId}`)
              .then(r => r.json())
              .then(data => { setInitiative(data.initiative); setNotes(data.notes ?? []) })
            onRefresh()
          }}
        />
      )}
    </div>
  )
}
