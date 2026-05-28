'use client'

import { useState, useRef, useEffect } from 'react'
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
const TS_DEPARTMENTS = ['ORG', 'SEO', 'Content', 'Paid Media', 'CRO', 'Dev & Support', 'Creative', 'Account Management', 'Data', 'Sales', 'SDR', 'OPS']

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
  const allEmails = teamList.map(m => m.email).filter(Boolean)
  const [docType, setDocType] = useState('SOP')
  const [docDepartment, setDocDepartment] = useState(DEPT_CODE[initiative.department ?? ''] ?? '')
  const [docVisibleTo, setDocVisibleTo] = useState<string[]>(allEmails)
  const [visOpen, setVisOpen] = useState(false)
  const visRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (visRef.current && !visRef.current.contains(e.target as Node)) setVisOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])
  const [docPurpose, setDocPurpose] = useState('')
  const [docContext, setDocContext] = useState('')
  const [docOwner, setDocOwner] = useState('')
  const [docTags, setDocTags] = useState('')
  const [tsTab, setTsTab] = useState('')
  const [tsDepartments, setTsDepartments] = useState<string[]>([])
  const [tsResponsible, setTsResponsible] = useState('')
  const [tsUsername, setTsUsername] = useState('')
  const [tsNotes, setTsNotes] = useState('')
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
      if (tsDepartments.length === 0) { setError('Tech Stack: At least one department is required.'); return }
      if (!tsResponsible) { setError('Tech Stack: Responsible for Update is required.'); return }
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
        doc_visible_to: docVisibleTo.join(','),
        doc_purpose: docPurpose,
        doc_context: docContext,
        doc_owner: docOwner,
        doc_tags: docTags,
        ts_tab: tsTab,
        ts_departments: tsDepartments.join(','),
        ts_responsible: tsResponsible,
        ts_username: tsUsername,
        ts_notes: tsNotes,
        ts_client_owner: tsClientOwner,
      }),
    })
    if (!res.ok) { setError('Failed to submit. Please try again.'); setSaving(false); return }
    onSubmitted()
  }

  return (
    <div className="overlay show" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ overflow: 'hidden' }}>
        <div className="complete-header">
          <div className="check-circle">
            <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
          <h3>Request Completion Approval</h3>
        </div>
        <p style={{ fontSize: '.82rem', color: 'var(--text-2)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
          Submitting <strong>{initiative.task_name}</strong> for approval. An email will be sent to leadership for review.
        </p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <div style={{ overflowY: 'auto', flex: 1, paddingRight: '.25rem' }}>
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

              <label className="modal-label">Visible To <span className="req">*</span></label>
              <div ref={visRef} style={{ position: 'relative', marginBottom: '.85rem' }}>
                <button
                  type="button"
                  onClick={() => setVisOpen(o => !o)}
                  style={{ width: '100%', background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '.75rem 1rem', fontFamily: 'var(--font)', fontSize: '.85rem', color: 'var(--text)', textAlign: 'left', cursor: 'pointer' }}
                >
                  {docVisibleTo.length === 0 ? 'No one selected'
                    : docVisibleTo.length === allEmails.length ? 'All team members'
                    : `${docVisibleTo.length} member${docVisibleTo.length !== 1 ? 's' : ''} selected`}
                </button>
                {visOpen && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'var(--bg-w)', border: '1.5px solid var(--border)', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 200, overflowY: 'auto', padding: '.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setDocVisibleTo(docVisibleTo.length === allEmails.length ? [] : allEmails)}
                      style={{ width: '100%', textAlign: 'left', padding: '.4rem .6rem', fontSize: '.72rem', fontWeight: 700, color: 'var(--blue-l)', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 6, marginBottom: '.25rem' }}
                    >
                      {docVisibleTo.length === allEmails.length ? 'Deselect all' : 'Select all'}
                    </button>
                    {teamList.map(m => (
                      <label key={m.email} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.35rem .6rem', fontSize: '.82rem', cursor: 'pointer', borderRadius: 6, color: 'var(--text)' }}>
                        <input
                          type="checkbox"
                          checked={docVisibleTo.includes(m.email)}
                          onChange={() => {
                            setDocVisibleTo(prev =>
                              prev.includes(m.email) ? prev.filter(e => e !== m.email) : [...prev, m.email]
                            )
                          }}
                          style={{ width: 14, height: 14, accentColor: 'var(--blue-l)', flexShrink: 0 }}
                        />
                        {m.display_name || m.email}
                      </label>
                    ))}
                  </div>
                )}
              </div>

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
                  <label className="modal-label">Client / Owner <span className="req">*</span></label>
                  <input type="text" placeholder="Which client owns this tool?" value={tsClientOwner} onChange={e => setTsClientOwner(e.target.value)} />
                </>
              )}

              <label className="modal-label">Department(s) <span className="req">*</span></label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem', marginBottom: '.85rem' }}>
                {TS_DEPARTMENTS.map(d => (
                  <label key={d} style={{ display: 'flex', alignItems: 'center', gap: '.3rem', fontSize: '.78rem', cursor: 'pointer', background: tsDepartments.includes(d) ? 'var(--blue-l)' : 'var(--bg)', color: tsDepartments.includes(d) ? '#fff' : 'var(--text-2)', border: '1.5px solid', borderColor: tsDepartments.includes(d) ? 'var(--blue-l)' : 'var(--border)', borderRadius: 8, padding: '.3rem .65rem', userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      style={{ display: 'none' }}
                      checked={tsDepartments.includes(d)}
                      onChange={() => setTsDepartments(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])}
                    />
                    {d}
                  </label>
                ))}
              </div>

              <label className="modal-label">Responsible for Update <span className="req">*</span></label>
              <select value={tsResponsible} onChange={e => setTsResponsible(e.target.value)}>
                <option value="">Select employee…</option>
                {teamList.map(m => (
                  <option key={m.email} value={m.display_name || m.email}>{m.display_name || m.email}</option>
                ))}
              </select>

              <label className="modal-label">Username</label>
              <input type="text" placeholder="Login username or email" value={tsUsername} onChange={e => setTsUsername(e.target.value)} />

              <label className="modal-label">Notes</label>
              <input type="text" placeholder="Any additional notes…" value={tsNotes} onChange={e => setTsNotes(e.target.value)} />
            </div>
          )}

          </div>

          {error && <p style={{ color: 'var(--danger)', fontSize: '.8rem', margin: '.5rem 0 0' }}>{error}</p>}

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
