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

const DOC_TYPES = ['SOP', 'GD', 'PB', 'FW', 'WF', 'TEMP', 'POL', 'REF', 'PRE']
const OWNER_ROLES = ['SEC', 'CMO', 'EVPO', 'COO', 'SDR', 'SEO', 'CRO', 'AM', 'DATA', 'CR', 'CONT', 'FIN', 'PAID', 'WS', 'EA']

export default function CompleteModal({ initiative, user, teamList, onClose, onSubmitted }: Props) {
  const [finalSummary, setFinalSummary] = useState('')
  const [sopLink, setSopLink] = useState(initiative.sop_link ?? '')
  const [toolLink, setToolLink] = useState(initiative.completion_links ?? '')
  const [participants, setParticipants] = useState(initiative.participants ?? '')
  const [docType, setDocType] = useState('SOP')
  const [docPurpose, setDocPurpose] = useState('')
  const [docContext, setDocContext] = useState('')
  const [docOwner, setDocOwner] = useState('')
  const [docTags, setDocTags] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const hasSop = sopLink.trim().length > 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!finalSummary.trim()) { setError('Please provide a completion summary.'); return }
    if (!sopLink.trim()) { setError('SOP / Documentation link is required.'); return }
    if (hasSop) {
      if (!docPurpose.trim()) { setError('Doc Registry: Purpose is required.'); return }
      if (!docContext.trim()) { setError('Doc Registry: Context is required.'); return }
      if (!docOwner) { setError('Doc Registry: Owner role is required.'); return }
    }
    setSaving(true)
    setError('')
    const res = await fetch(`/api/initiatives/${initiative.id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        final_summary: finalSummary,
        sop_link: sopLink,
        tool_link: toolLink,
        participants,
        doc_type: docType,
        doc_purpose: docPurpose,
        doc_context: docContext,
        doc_owner: docOwner,
        doc_tags: docTags,
      }),
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

          <label className="modal-label">SOP / Documentation Link <span className="req">*</span></label>
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

          {hasSop && (
            <div style={{ borderTop: '1px solid var(--border)', marginTop: '1rem', paddingTop: '1rem' }}>
              <div style={{ fontSize: '.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-3)', marginBottom: '.75rem' }}>
                Doc Registry Details
              </div>

              <label className="modal-label">Document Type <span className="req">*</span></label>
              <select value={docType} onChange={e => setDocType(e.target.value)}>
                {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>

              <label className="modal-label">
                Purpose <span className="req">*</span>
                <span style={{ fontSize: '.68rem', color: 'var(--text-3)', fontWeight: 400, marginLeft: '.35rem' }}>e.g. Onboarding, ClientReporting</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Onboarding"
                value={docPurpose}
                onChange={e => setDocPurpose(e.target.value)}
              />

              <label className="modal-label">
                Context <span className="req">*</span>
                <span style={{ fontSize: '.68rem', color: 'var(--text-3)', fontWeight: 400, marginLeft: '.35rem' }}>e.g. NewHires, AllTeams</span>
              </label>
              <input
                type="text"
                placeholder="e.g. AllTeams"
                value={docContext}
                onChange={e => setDocContext(e.target.value)}
              />

              <label className="modal-label">Document Owner <span className="req">*</span></label>
              <select value={docOwner} onChange={e => setDocOwner(e.target.value)}>
                <option value="">Select owner role…</option>
                {OWNER_ROLES.map(r => <option key={r}>{r}</option>)}
              </select>

              <label className="modal-label">
                Tags
                <span style={{ fontSize: '.68rem', color: 'var(--text-3)', fontWeight: 400, marginLeft: '.35rem' }}>(optional, comma-separated)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. onboarding, HR, process"
                value={docTags}
                onChange={e => setDocTags(e.target.value)}
              />
            </div>
          )}

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
