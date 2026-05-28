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
const DOC_DEPARTMENTS = ['ORG', 'SDR', 'OPS', 'AM', 'DATA', 'CR', 'SEO', 'CRO', 'FIN', 'CONT', 'WS', 'PAID', 'EA']
const TS_TABS = ['Internal Tools', 'Client Tools', 'ST Tools']

const DEPT_CODE: Record<string, string> = {
  'Operations': 'OPS', 'Content': 'CONT', 'SEO': 'SEO', 'Design': 'CR',
  'CRO': 'CRO', 'Data & Innovation': 'DATA', 'Account Managers': 'AM',
  'Sales': 'SDR', 'Finance': 'FIN', 'Paid': 'PAID',
  'Executive Assistant': 'EA', 'Organization': 'ORG',
}

export default function CompleteModal({ initiative, user, teamList, onClose, onSubmitted }: Props) {
  const [finalSummary, setFinalSummary] = useState('')
  const [sopLink, setSopLink] = useState(initiative.sop_link ?? '')
  const [toolLink, setToolLink] = useState(initiative.completion_links ?? '')
  const [participants, setParticipants] = useState(initiative.participants ?? '')
  const [docType, setDocType] = useState('SOP')
  const [docDepartment, setDocDepartment] = useState(DEPT_CODE[initiative.department ?? ''] ?? '')
  const [docPurpose, setDocPurpose] = useState('')
  const [docContext, setDocContext] = useState('')
  const [docOwner, setDocOwner] = useState('')
  const [docTags, setDocTags] = useState('')
  const [tsTab, setTsTab] = useState('')
  const [tsCategory, setTsCategory] = useState('')
  const [tsUseCase, setTsUseCase] = useState('')
  const [tsResponsible, setTsResponsible] = useState('')
  const [tsGoogleSignin, setTsGoogleSignin] = useState(false)
  const [tsClientOwner, setTsClientOwner] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const hasSop = sopLink.trim().length > 0
  const isTool = initiative.type === 'Tool'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!finalSummary.trim()) { setError('Please provide a completion summary.'); return }
    if (!sopLink.trim()) { setError('SOP / Documentation link is required.'); return }
    if (hasSop) {
      if (!docDepartment) { setError('Doc Registry: Department is required.'); return }
      if (!docPurpose.trim()) { setError('Doc Registry: Purpose is required.'); return }
      if (!docContext.trim()) { setError('Doc Registry: Context is required.'); return }
      if (!docOwner) { setError('Doc Registry: Owner role is required.'); return }
    }
    if (isTool) {
      if (!tsTab) { setError('Tech Stack: Tab is required.'); return }
      if (!tsCategory.trim()) { setError('Tech Stack: Category is required.'); return }
      if (!tsUseCase.trim()) { setError('Tech Stack: Use Case is required.'); return }
      if (!tsResponsible.trim()) { setError('Tech Stack: Responsible for Updates is required.'); return }
      if (tsTab === 'Client Tools' && !tsClientOwner.trim()) { setError('Tech Stack: Client Owner is required for Client Tools.'); return }
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
        doc_department: docDepartment,
        doc_purpose: docPurpose,
        doc_context: docContext,
        doc_owner: docOwner,
        doc_tags: docTags,
        ts_tab: tsTab,
        ts_category: tsCategory,
        ts_use_case: tsUseCase,
        ts_responsible: tsResponsible,
        ts_google_signin: tsGoogleSignin,
        ts_client_owner: tsClientOwner,
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

              <label className="modal-label">Department <span className="req">*</span></label>
              <select value={docDepartment} onChange={e => setDocDepartment(e.target.value)}>
                <option value="">Select department…</option>
                {DOC_DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
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

          {isTool && (
            <div style={{ borderTop: '1px solid var(--border)', marginTop: '1rem', paddingTop: '1rem' }}>
              <div style={{ fontSize: '.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-3)', marginBottom: '.75rem' }}>
                Tech Stack Details
              </div>

              <label className="modal-label">Tab <span className="req">*</span></label>
              <select value={tsTab} onChange={e => setTsTab(e.target.value)}>
                <option value="">Select tab…</option>
                {TS_TABS.map(t => <option key={t}>{t}</option>)}
              </select>

              {tsTab === 'Client Tools' && (
                <>
                  <label className="modal-label">Client Owner <span className="req">*</span></label>
                  <input type="text" placeholder="Which client owns this tool?" value={tsClientOwner} onChange={e => setTsClientOwner(e.target.value)} />
                </>
              )}

              <label className="modal-label">
                Category <span className="req">*</span>
                <span style={{ fontSize: '.68rem', color: 'var(--text-3)', fontWeight: 400, marginLeft: '.35rem' }}>e.g. SEO, Analytics, CRM</span>
              </label>
              <input type="text" placeholder="e.g. Analytics" value={tsCategory} onChange={e => setTsCategory(e.target.value)} />

              <label className="modal-label">Use Case <span className="req">*</span></label>
              <input type="text" placeholder="What problem does this tool solve?" value={tsUseCase} onChange={e => setTsUseCase(e.target.value)} />

              <label className="modal-label">Responsible for Updates <span className="req">*</span></label>
              <input type="text" placeholder="Who maintains this tool?" value={tsResponsible} onChange={e => setTsResponsible(e.target.value)} />

              <label className="modal-label">Uses Google Sign-In?</label>
              <select value={tsGoogleSignin ? 'true' : 'false'} onChange={e => setTsGoogleSignin(e.target.value === 'true')}>
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
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
