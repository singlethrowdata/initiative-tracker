'use client'

import { useState, useEffect } from 'react'
import { Initiative, TeamMember, InitiativeNote } from '@/types'
import { fmt, fmtRelative, initials, statusClass, priorityClass, parseLinks } from '@/lib/ui'
import UpdatesExpand from '@/components/shared/UpdatesExpand'

interface Props {
  initiativeId: string
  user: { email: string; name: string }
  canDelete: boolean
  teamList: TeamMember[]
  onClose: () => void
  onRefresh: () => void
}

export default function DetailsPanel({ initiativeId, user, teamList, onClose, onRefresh }: Props) {
  const [initiative, setInitiative] = useState<Initiative | null>(null)
  const [notes, setNotes] = useState<InitiativeNote[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')
  const [posting, setPosting] = useState(false)

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

  const links = parseLinks(initiative?.links ?? '')
  const completionLinks = parseLinks(initiative?.completion_links ?? '')
  const participants = initiative?.participants
    ? initiative.participants.split(',').map(p => p.trim()).filter(Boolean)
    : []

  return (
    <div className={`details-panel${open ? ' open' : ''}`}>
      <nav className="details-nav">
        <div className="details-nav-left">
          <button className="details-back" onClick={handleClose}>
            <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" /></svg>
            Back
          </button>
          {initiative && (
            <div className="details-crumb">
              Initiatives → <span>{initiative.task_name}</span>
            </div>
          )}
        </div>
        {initiative && (
          <span className={`pill ${statusClass(initiative.status)}`} style={{ fontSize: '.7rem' }}>
            <span className="d" />{initiative.status}
          </span>
        )}
      </nav>

      {loading ? (
        <div className="loading"><div className="spinner" /><div>Loading…</div></div>
      ) : initiative ? (
        <div className="details-body">

          {/* Hero card */}
          <div className="dp-hero">
            <div className="dp-logo-box">
              <div className="dp-logo-icon">
                <svg viewBox="0 0 24 24">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18M9 21V9" />
                </svg>
              </div>
              <div className="dp-logo-label">{initiative.department || 'Initiative'}</div>
              <div className="dp-type-badge">{initiative.type}</div>
            </div>
            <div className="dp-info">
              <div className="dp-info-title">{initiative.task_name}</div>
              <div className="dp-info-meta">
                <span className={`pill ${statusClass(initiative.status)}`} style={{ fontSize: '.72rem' }}>
                  <span className="d" />{initiative.status}
                </span>
                <span className={priorityClass(initiative.priority)} style={{ fontWeight: 700, fontSize: '.72rem' }}>
                  {initiative.priority}
                </span>
                <span style={{ fontSize: '.72rem', color: 'var(--text-3)' }}>
                  Created by {initiative.created_by_name} · {fmtRelative(initiative.created_at)}
                </span>
              </div>
            </div>
          </div>

          {/* Spec grid */}
          <div className="dp-spec-grid" style={{ marginBottom: '1.5rem' }}>
            <SpecCard label="Status" value={initiative.status} />
            <SpecCard label="Priority" value={initiative.priority} />
            <SpecCard label="Type" value={initiative.type} />
            {initiative.department && <SpecCard label="Department" value={initiative.department} />}
            {initiative.start_date && <SpecCard label="Start Date" value={fmt(initiative.start_date)} />}
            {initiative.anticipated_end_date && <SpecCard label="Target End" value={fmt(initiative.anticipated_end_date)} />}
            {initiative.actual_end_date && <SpecCard label="Completed" value={fmt(initiative.actual_end_date)} />}
            {initiative.waiting_on && <SpecCard label="Waiting On" value={initiative.waiting_on} />}
          </div>

          {/* Description */}
          {initiative.description && (
            <div className="dp-desc-block" style={{ marginBottom: '1.5rem' }}>
              <h4>Description</h4>
              <p>{initiative.description}</p>
            </div>
          )}

          {/* Notes field (internal notes on the initiative record) */}
          {initiative.notes && (
            <div className="dp-desc-block" style={{ marginBottom: '1.5rem' }}>
              <h4>Notes</h4>
              <p>{initiative.notes}</p>
            </div>
          )}

          {/* Participants */}
          {participants.length > 0 && (
            <div className="dp-desc-block" style={{ marginBottom: '1.5rem' }}>
              <h4>Participants</h4>
              <div className="dp-participants" style={{ marginTop: '.5rem' }}>
                {participants.map((name, i) => (
                  <div key={i} className="dp-part-chip">
                    <div className="dp-part-avatar">{initials(name)}</div>
                    {name}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Links */}
          {links.length > 0 && (
            <div className="dp-links-block" style={{ marginBottom: '1.5rem' }}>
              {links.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noreferrer" className="link-chip">
                  ↗ {url.replace(/^https?:\/\//, '').slice(0, 50)}
                </a>
              ))}
            </div>
          )}

          {/* Completion block */}
          {initiative.is_archived && initiative.completion_desc && (
            <div className="dp-completion-block" style={{ marginBottom: '1.5rem' }}>
              <div className="dp-comp-label">Completion Summary</div>
              <p style={{ fontSize: '.88rem', color: 'var(--text-2)', lineHeight: 1.7, marginTop: '.5rem' }}>
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

          {/* Updates section */}
          <div className="dp-timeline-updates" style={{ marginBottom: '1.5rem' }}>
            {initiative.waiting_on && (
              <div className="dp-waiting-banner">
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4l3 3" />
                </svg>
                <span>Waiting on <strong>{initiative.waiting_on}</strong></span>
              </div>
            )}
            <div style={{ padding: '1.25rem 1.75rem' }}>
              <UpdatesExpand
                initiative={initiative}
                user={user}
                teamList={teamList}
                onRefresh={onRefresh}
              />
            </div>
          </div>

          {/* Team notes stream */}
          <div className="dp-timeline-updates">
            <div className="dp-section-head">
              <h4>Team Notes</h4>
            </div>
            <div className="dp-notes-stream">
              <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1rem' }}>
                <input
                  type="text"
                  placeholder="Add a note visible to the team…"
                  value={noteDraft}
                  style={{
                    flex: 1,
                    fontFamily: 'var(--font)',
                    fontSize: '.82rem',
                    border: '1.5px solid var(--border)',
                    borderRadius: 10,
                    padding: '.55rem .9rem',
                    background: 'var(--bg)',
                    color: 'var(--text)',
                  }}
                  onChange={e => setNoteDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleNotePost() }}
                />
                <button
                  className="btn btn-soft btn-xs"
                  onClick={handleNotePost}
                  disabled={posting || !noteDraft.trim()}
                >
                  {posting ? '…' : 'Post'}
                </button>
              </div>
              {notes.length === 0 ? (
                <p style={{ color: 'var(--text-3)', fontSize: '.78rem' }}>No team notes yet.</p>
              ) : notes.map(n => (
                <div key={n.id} className="dp-note-entry">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.3rem' }}>
                    <span style={{ fontSize: '.72rem', fontWeight: 700 }}>{n.user_name}</span>
                    <span style={{ fontSize: '.65rem', color: 'var(--text-3)' }}>{fmtRelative(n.created_at)}</span>
                  </div>
                  <div style={{ fontSize: '.82rem', color: 'var(--text-2)', lineHeight: 1.6 }}>{n.content}</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      ) : (
        <div className="empty">
          <h3>Initiative not found</h3>
        </div>
      )}
    </div>
  )
}

function SpecCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="dp-spec">
      <div className="dp-spec-label">{label}</div>
      <div className="dp-spec-value">{value}</div>
    </div>
  )
}
