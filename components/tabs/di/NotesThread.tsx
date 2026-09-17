'use client'

import { useCallback, useEffect, useState } from 'react'
import { DiInitiative, DiUpdate } from '@/types'
import { initials, fmtRelative } from '@/lib/ui'

interface Props {
  initiative: DiInitiative
  isDiTeam: boolean
}

/** A running, timestamped note log per D+I project — the "why is this blocked,
 * and what's the history behind it" place that lexicon/status fields alone don't
 * cover. Backed by di_updates (id/content/user/created_at — deliberately simpler
 * than the Initiative Tracker's Update/Milestone system on the Tracker tab,
 * which this does not reuse since the two data models genuinely differ).
 * Readable by anyone signed in (ADR-0002: company-wide visibility extends to
 * *why* a project is stuck, not just that it is) — the compose box is the only
 * part gated to D+I team members.
 * Shared by DiNotesModal (Queued/Completed rows, which have no timeline) and
 * GanttRow's inline detail panel (Active rows) — one source of truth for the
 * fetch/compose/list logic so there's exactly one place di_updates is wired up. */
export default function NotesThread({ initiative, isDiTeam }: Props) {
  const [notes, setNotes] = useState<DiUpdate[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const res = await fetch(`/api/di-initiatives/${initiative.id}/updates`)
    if (res.ok) setNotes(await res.json())
    setLoading(false)
  }, [initiative.id])

  useEffect(() => { load() }, [load])

  async function handlePost() {
    if (!draft.trim()) return
    setPosting(true)
    setError('')
    const res = await fetch(`/api/di-initiatives/${initiative.id}/updates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: draft.trim() }),
    })
    if (!res.ok) { setError('Failed to post. Please try again.'); setPosting(false); return }
    const created: DiUpdate = await res.json()
    setNotes(prev => [created, ...prev])
    setDraft('')
    setPosting(false)
  }

  return (
    <>
      {loading ? (
        <div className="loading"><div className="spinner" /><div>Loading&hellip;</div></div>
      ) : notes.length === 0 ? (
        <p className="stage-hint">No notes yet.</p>
      ) : (
        <div className="comments">
          {notes.map(n => (
            <div key={n.id} className="cmt">
              <div className="cmt-avatar">{initials(n.user_name)}</div>
              <div className="cmt-body">
                <div className="cn">{n.user_name}</div>
                <div className="ct">{n.content}</div>
                <div className="cd">{fmtRelative(n.created_at)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isDiTeam && (
        <div className="note-compose">
          <label className="modal-label">Add a note</label>
          <textarea
            placeholder="e.g. why it's blocked, a decision made, context for whoever picks this up…"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={3}
          />
          {error && <p style={{ color: 'var(--danger)', fontSize: '.8rem' }}>{error}</p>}
          <button type="button" className="btn btn-grad btn-sm" onClick={handlePost} disabled={posting || !draft.trim()}>
            {posting ? 'Posting…' : 'Post Note'}
          </button>
        </div>
      )}
    </>
  )
}
