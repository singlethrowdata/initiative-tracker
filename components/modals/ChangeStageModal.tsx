'use client'

import { useState } from 'react'
import { DiInitiative } from '@/types'
import { STATUS_VALUES, BLOCKER_CATEGORIES } from '@/lib/di-scheduling'

interface Props {
  initiative: DiInitiative
  onClose: () => void
  onSaved: () => void
}

const BLOCKER_LABEL: Record<string, string> = {
  internal_capacity: 'Internal capacity',
  pm_scheduling: 'PM / scheduling',
  client_external: 'Client / external',
  other: 'Other',
}

// The natural forward path through the pipeline — used only to default the
// picker to "whatever's next," never to restrict which stage can be picked.
// Blocked/Paused/Done have no unambiguous "next," so they default to
// themselves, which forces an explicit pick (submit is disabled until the
// selection actually differs from the current stage).
const STAGE_ORDER = ['Backlog', 'In Queue', 'Design', 'Build', 'QA', 'Awaiting Approval', 'Deploy', 'Done']

function defaultNextStage(current: string): string {
  const idx = STAGE_ORDER.indexOf(current)
  if (idx === -1 || idx === STAGE_ORDER.length - 1) return current
  return STAGE_ORDER[idx + 1]
}

/** A dedicated, single-purpose flow for moving a project to its next stage —
 * separate from EditDIInitiativeModal, which owns everything else about a
 * project (name, RICE, estimates, links) but no longer touches status. Shows
 * only the fields the target stage actually needs: nothing extra for a plain
 * stage move, blocker category + note for Blocked, an optional note for
 * Paused. Always a transition (this stage -> a different one) — re-recording
 * the same stage isn't supported here, matching what the API accepts. */
export default function ChangeStageModal({ initiative, onClose, onSaved }: Props) {
  const [newStatus, setNewStatus] = useState(defaultNextStage(initiative.status))
  const [blockerCategory, setBlockerCategory] = useState('')
  const [blockerNote, setBlockerNote] = useState('')
  const [statusNote, setStatusNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const unchanged = newStatus === initiative.status
  const movingToBlocked = newStatus === 'Blocked'
  const movingToPaused = newStatus === 'Paused'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (unchanged) return
    if (movingToBlocked && !blockerCategory) { setError('Blocker category is required.'); return }
    if (movingToBlocked && !blockerNote.trim()) { setError('Blocker note is required.'); return }
    setSaving(true)
    setError('')

    const body: Record<string, unknown> = { status: newStatus }
    if (movingToBlocked) {
      body.blocker_category = blockerCategory
      body.blocker_note = blockerNote.trim()
    }
    if (movingToPaused) {
      body.status_note = statusNote.trim()
    }

    const res = await fetch(`/api/di-initiatives/${initiative.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) { setError('Failed to save. Please try again.'); setSaving(false); return }
    onSaved()
  }

  return (
    <div className="overlay show" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <h3>Change Stage</h3>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p className="stage-current">
              <span className="gantt-name">{initiative.project_name}</span>
              <br />
              Currently: <b>{initiative.status}</b>
            </p>

            <label className="modal-label">New Stage</label>
            <select value={newStatus} onChange={e => setNewStatus(e.target.value)} autoFocus>
              {STATUS_VALUES.map(s => <option key={s}>{s}</option>)}
            </select>

            {movingToBlocked && (
              <>
                <label className="modal-label">Blocker Category <span className="req">*</span></label>
                <select value={blockerCategory} onChange={e => setBlockerCategory(e.target.value)}>
                  <option value="">— Select —</option>
                  {BLOCKER_CATEGORIES.map(c => <option key={c} value={c}>{BLOCKER_LABEL[c]}</option>)}
                </select>

                <label className="modal-label">Blocker Note <span className="req">*</span></label>
                <textarea placeholder="What's blocking this?" value={blockerNote} onChange={e => setBlockerNote(e.target.value)} rows={2} />
              </>
            )}

            {movingToPaused && (
              <>
                <label className="modal-label">Note</label>
                <input type="text" placeholder="Optional note about why it's paused…" value={statusNote} onChange={e => setStatusNote(e.target.value)} />
              </>
            )}

            {unchanged && <p className="stage-hint">Pick a different stage to record the move.</p>}
            {error && <p style={{ color: 'var(--danger)', fontSize: '.8rem', marginTop: '.5rem' }}>{error}</p>}
          </div>

          <div className="modal-foot">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-grad" disabled={saving || unchanged}>
              {saving ? 'Saving…' : 'Move Stage'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
