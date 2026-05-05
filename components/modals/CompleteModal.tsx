'use client'

import { useState } from 'react'
import { Initiative, TeamMember } from '@/types'

interface Props {
  initiative: Initiative
  user: { email: string; name: string }
  teamList: TeamMember[]
  onClose: () => void
  onSubmitted: () => void
}

export default function CompleteModal({ initiative, user, teamList, onClose, onSubmitted }: Props) {
  const [finalSummary, setFinalSummary] = useState('')
  const [sopLink, setSopLink] = useState(initiative.sop_link ?? '')
  const [toolLink, setToolLink] = useState(initiative.completion_links ?? '')
  const [participants, setParticipants] = useState(initiative.participants ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!finalSummary.trim()) { setError('Please provide a completion summary.'); return }
    setSaving(true)
    setError('')
    const res = await fetch(`/api/initiatives/${initiative.id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ final_summary: finalSummary, sop_link: sopLink, tool_link: toolLink, participants }),
    })
    if (!res.ok) { setError('Failed to submit. Please try again.'); setSaving(false); return }
    onSubmitted()
  }

  return (
    <div className="overlay show" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="complete-header">
          <div className="check-circle">
            <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
          <h3>Request Completion Approval</h3>
        </div>
        <p style={{ fontSize: '.82rem', color: 'var(--text-2)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
          Submitting <strong>{initiative.task_name}</strong> for approval. An email will be sent to leadership for review.
        </p>
        <form onSubmit={handleSubmit}>
          <label className="modal-label">Final Summary <span className="req">*</span></label>
          <textarea
            placeholder="Summarize what was accomplished, outcomes, and impact…"
            value={finalSummary}
            onChange={e => setFinalSummary(e.target.value)}
            rows={4}
            autoFocus
          />

          <label className="modal-label">SOP / Documentation Link</label>
          <input type="text" placeholder="https://…" value={sopLink} onChange={e => setSopLink(e.target.value)} />

          <label className="modal-label">Tool / Resource Link</label>
          <input type="text" placeholder="https://…" value={toolLink} onChange={e => setToolLink(e.target.value)} />

          <label className="modal-label">Participants</label>
          <input
            type="text"
            placeholder="Who contributed to this initiative?"
            value={participants}
            onChange={e => setParticipants(e.target.value)}
          />

          {error && <p style={{ color: 'var(--danger)', fontSize: '.8rem', marginBottom: '.5rem' }}>{error}</p>}

          <div className="modal-foot">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-grad" disabled={saving}>
              {saving ? 'Submitting…' : 'Submit for Approval'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
