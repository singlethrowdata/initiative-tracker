'use client'

import { useState } from 'react'
import { AiRecommendation } from '@/types'

interface Props {
  initiativeId: string
  initiativeName: string
  teamList: { display_name: string }[]
  onClose: () => void
  onApplied: () => void
}

type Step = 'input' | 'review'
type Mode = 'link' | 'paste'

export default function MeetingAnalysisModal({ initiativeId, initiativeName, teamList, onClose, onApplied }: Props) {
  const [step, setStep] = useState<Step>('input')
  const [mode, setMode] = useState<Mode>('link')
  const [docUrl, setDocUrl] = useState('')
  const [docTitle, setDocTitle] = useState('')
  const [transcript, setTranscript] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState('')
  const [recommendations, setRecommendations] = useState<AiRecommendation[]>([])

  const canAnalyze = mode === 'link' ? docUrl.trim().length > 0 : transcript.trim().length > 0

  async function handleAnalyze() {
    if (!canAnalyze) return
    setAnalyzing(true)
    setError('')
    const body = mode === 'link' ? { docUrl } : { transcript }
    const res = await fetch(`/api/initiatives/${initiativeId}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setAnalyzing(false)
    if (!res.ok) { setError(data.error ?? 'Analysis failed. Please try again.'); return }
    if (!data.recommendations?.length) { setError('No recommendations found in these notes.'); return }
    setRecommendations(data.recommendations)
    setStep('review')
  }

  function toggleApproval(id: string) {
    setRecommendations(prev => prev.map(r => r.id === id ? { ...r, approved: !r.approved } : r))
  }

  function updateField(id: string, field: keyof AiRecommendation, value: string) {
    setRecommendations(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  async function handleApply() {
    const approved = recommendations.filter(r => r.approved)
    if (!approved.length) return
    setApplying(true)
    setError('')

    const errors: string[] = []

    for (const rec of approved) {
      if (rec.type === 'milestone') {
        const validDate = /^\d{4}-\d{2}-\d{2}$/.test(rec.target_date) ? rec.target_date : null
        const res = await fetch(`/api/initiatives/${initiativeId}/updates`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: rec.description,
            assigned_to: rec.assigned_to || '',
            target_date: validDate,
          }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          errors.push(`Milestone failed: ${data.error ?? res.statusText}`)
        }
      } else {
        const res = await fetch(`/api/initiatives/${initiativeId}/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: rec.description }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          errors.push(`Note failed: ${data.error ?? res.statusText}`)
        }
      }
    }

    // Add the Google Doc URL to the initiative's links section
    if (mode === 'link' && docUrl && !errors.length) {
      const iRes = await fetch(`/api/initiatives/${initiativeId}`)
      const iData = await iRes.json()
      const existing = iData.initiative?.links ?? ''
      const newEntry = `${docTitle.trim() || 'Meeting Notes'} ${docUrl}`
      const alreadyAdded = existing.includes(docUrl)
      if (!alreadyAdded) {
        const updated = existing ? `${existing},${newEntry}` : newEntry
        await fetch(`/api/initiatives/${initiativeId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ links: updated }),
        })
      }
    }

    setApplying(false)
    if (errors.length) {
      setError(errors.join(' · '))
    } else {
      onApplied()
    }
  }

  const approvedCount = recommendations.filter(r => r.approved).length
  const memberNames = teamList.map(m => m.display_name)

  return (
    <div className="overlay show" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ maxWidth: 620 }}>

        {step === 'input' ? (
          <>
            <div style={{ marginBottom: '1.25rem' }}>
              <h3 style={{ marginBottom: '.25rem' }}>Analyze Meeting Notes</h3>
              <p style={{ fontSize: '.78rem', color: 'var(--text-3)', margin: 0 }}>
                Analyze notes for <strong style={{ color: 'var(--text-2)' }}>{initiativeName}</strong>. Claude will suggest milestones and notes.
              </p>
            </div>

            {/* Mode toggle */}
            <div style={{ display: 'flex', gap: '.35rem', marginBottom: '1.25rem', background: 'var(--bg)', padding: '.25rem', borderRadius: 10, width: 'fit-content' }}>
              {(['link', 'paste'] as Mode[]).map(m => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError('') }}
                  style={{
                    padding: '.35rem .85rem',
                    borderRadius: 8,
                    border: 'none',
                    fontFamily: 'var(--font)',
                    fontSize: '.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: mode === m ? 'var(--bg-w)' : 'transparent',
                    color: mode === m ? 'var(--text)' : 'var(--text-3)',
                    boxShadow: mode === m ? 'var(--shadow)' : 'none',
                    transition: 'all .15s',
                  }}
                >
                  {m === 'link' ? 'Google Doc Link' : 'Paste Text'}
                </button>
              ))}
            </div>

            <div className="modal-body">
              {mode === 'link' ? (
                <div>
                  <label className="modal-label">Google Doc URL</label>
                  <input
                    type="url"
                    placeholder="https://docs.google.com/document/d/…"
                    value={docUrl}
                    onChange={e => setDocUrl(e.target.value)}
                    autoFocus
                    style={{ marginBottom: '.65rem' }}
                  />
                  <label className="modal-label">Link Title <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional — defaults to "Meeting Notes")</span></label>
                  <input
                    type="text"
                    placeholder="e.g. Q2 Planning Meeting — June 1"
                    value={docTitle}
                    onChange={e => setDocTitle(e.target.value)}
                    style={{ marginBottom: '.5rem' }}
                  />
                  <p style={{ fontSize: '.72rem', color: 'var(--text-3)', marginBottom: 0 }}>
                    The document must be set to <strong>Anyone with the link can view</strong>.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="modal-label">Meeting Notes / Transcript</label>
                  <textarea
                    placeholder="Paste your meeting notes or transcript here…"
                    value={transcript}
                    onChange={e => setTranscript(e.target.value)}
                    rows={12}
                    style={{ resize: 'vertical', minHeight: 200 }}
                    autoFocus
                  />
                </div>
              )}

              {error && (
                <p style={{ fontSize: '.78rem', color: 'var(--danger)', marginTop: '.5rem', marginBottom: 0 }}>{error}</p>
              )}
            </div>

            <div className="modal-foot">
              <button className="btn btn-soft btn-sm" onClick={onClose}>Cancel</button>
              <button
                className="btn btn-grad btn-sm"
                onClick={handleAnalyze}
                disabled={analyzing || !canAnalyze}
              >
                {analyzing ? (
                  <>
                    <span className="spinner" style={{ width: 13, height: 13, borderWidth: 2 }} />
                    Analyzing…
                  </>
                ) : 'Analyze'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ marginBottom: '1.25rem' }}>
              <h3 style={{ marginBottom: '.25rem' }}>Recommended Next Steps</h3>
              <p style={{ fontSize: '.78rem', color: 'var(--text-3)', margin: 0 }}>
                {recommendations.length} recommendation{recommendations.length !== 1 ? 's' : ''} from your meeting notes.
                Toggle off any you want to skip.
              </p>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
              {recommendations.map(rec => (
                <RecCard
                  key={rec.id}
                  rec={rec}
                  memberNames={memberNames}
                  onToggle={() => toggleApproval(rec.id)}
                  onUpdate={(field, val) => updateField(rec.id, field, val)}
                />
              ))}

              {error && (
                <p style={{ fontSize: '.78rem', color: 'var(--danger)', margin: 0 }}>{error}</p>
              )}
            </div>

            <div className="modal-foot">
              <button className="btn btn-soft btn-sm" onClick={() => { setStep('input'); setError('') }}>
                ← Back
              </button>
              <button
                className="btn btn-grad btn-sm"
                onClick={handleApply}
                disabled={applying || approvedCount === 0}
              >
                {applying ? (
                  <>
                    <span className="spinner" style={{ width: 13, height: 13, borderWidth: 2 }} />
                    Applying…
                  </>
                ) : `Apply ${approvedCount} Approved`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

interface RecCardProps {
  rec: AiRecommendation
  memberNames: string[]
  onToggle: () => void
  onUpdate: (field: keyof AiRecommendation, val: string) => void
}

function RecCard({ rec, memberNames, onToggle, onUpdate }: RecCardProps) {
  const isMilestone = rec.type === 'milestone'

  return (
    <div style={{
      border: '1.5px solid var(--border)',
      borderRadius: 14,
      padding: '1rem',
      background: rec.approved ? 'var(--bg-w)' : 'var(--bg)',
      opacity: rec.approved ? 1 : 0.5,
      transition: 'all .2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '.75rem' }}>
        <button
          onClick={onToggle}
          style={{
            flexShrink: 0,
            width: 24,
            height: 24,
            borderRadius: 6,
            border: `2px solid ${rec.approved ? 'var(--green)' : 'var(--border-hover)'}`,
            background: rec.approved ? 'var(--green)' : 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 1,
            transition: 'all .15s',
          }}
          title={rec.approved ? 'Click to skip' : 'Click to include'}
        >
          {rec.approved && (
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ marginBottom: '.5rem' }}>
            <span style={{
              display: 'inline-block',
              fontSize: '.6rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '.08em',
              padding: '.2rem .5rem',
              borderRadius: 6,
              background: isMilestone ? 'rgba(41,128,185,0.12)' : 'rgba(107,143,113,0.12)',
              color: isMilestone ? 'var(--blue-l)' : 'var(--green)',
            }}>
              {isMilestone ? 'Milestone' : 'Note'}
            </span>
          </div>

          <textarea
            value={rec.description}
            onChange={e => onUpdate('description', e.target.value)}
            rows={2}
            style={{
              width: '100%',
              background: 'var(--bg)',
              border: '1.5px solid var(--border)',
              borderRadius: 10,
              padding: '.5rem .75rem',
              fontFamily: 'var(--font)',
              fontSize: '.82rem',
              color: 'var(--text)',
              resize: 'vertical',
              lineHeight: 1.55,
              marginBottom: isMilestone ? '.6rem' : 0,
            }}
          />

          {isMilestone && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem' }}>
              <div>
                <div style={{ fontSize: '.6rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '.25rem' }}>Assigned To</div>
                <select
                  value={rec.assigned_to}
                  onChange={e => onUpdate('assigned_to', e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg)',
                    border: '1.5px solid var(--border)',
                    borderRadius: 10,
                    padding: '.4rem .75rem',
                    fontFamily: 'var(--font)',
                    fontSize: '.78rem',
                    color: rec.assigned_to ? 'var(--text)' : 'var(--text-3)',
                  }}
                >
                  <option value="">Unassigned</option>
                  {memberNames.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: '.6rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '.25rem' }}>Target Date</div>
                <input
                  type="date"
                  value={rec.target_date}
                  onChange={e => onUpdate('target_date', e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg)',
                    border: '1.5px solid var(--border)',
                    borderRadius: 10,
                    padding: '.4rem .75rem',
                    fontFamily: 'var(--font)',
                    fontSize: '.78rem',
                    color: 'var(--text)',
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
