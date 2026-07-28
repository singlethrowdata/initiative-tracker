'use client'

import { useState, useEffect } from 'react'
import { DiInitiative, DiStatusHistoryEntry } from '@/types'
import { fmt, diStatusClass } from '@/lib/ui'
import { BLOCKER_CATEGORIES } from '@/lib/di-scheduling'
import StageTimelineBar from '@/components/tabs/di/StageTimelineBar'
import EditDIInitiativeModal from '@/components/modals/EditDIInitiativeModal'

interface Props {
  initiativeId: string
  onClose: () => void
  onRefresh: () => void
}

const BLOCKER_LABEL: Record<string, string> = {
  internal_capacity: 'Internal Capacity',
  pm_scheduling: 'PM / Meeting Scheduling',
  client_external: 'Client / External',
  other: 'Other',
}

export default function DIDetailsPanel({ initiativeId, onClose, onRefresh }: Props) {
  const [initiative, setInitiative] = useState<DiInitiative | null>(null)
  const [history, setHistory] = useState<DiStatusHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [blockerCategory, setBlockerCategory] = useState('')
  const [blockerNote, setBlockerNote] = useState('')
  const [savingBlocker, setSavingBlocker] = useState(false)

  const load = () => {
    setLoading(true)
    fetch(`/api/di-initiatives/${initiativeId}`)
      .then(r => r.json())
      .then(data => {
        setInitiative(data.initiative)
        setHistory(data.history ?? [])
        const openRow = (data.history ?? []).find((h: DiStatusHistoryEntry) => !h.exited_at)
        setBlockerCategory(openRow?.blocker_category ?? '')
        setBlockerNote(openRow?.blocker_note ?? '')
        setLoading(false)
      })
  }

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(load, [initiativeId])
  useEffect(() => { requestAnimationFrame(() => setOpen(true)) }, [])

  function handleClose() {
    setOpen(false)
    setTimeout(onClose, 200)
  }

  async function saveBlocker() {
    setSavingBlocker(true)
    await fetch(`/api/di-initiatives/${initiativeId}/blocker`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocker_category: blockerCategory || null, blocker_note: blockerNote || null }),
    })
    setSavingBlocker(false)
    load()
    onRefresh()
  }

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
              D+I Roadmap / <span>{initiative.project_name}</span>
            </div>
          )}
        </div>
        {initiative && (
          <button className="btn btn-soft btn-sm" onClick={() => setShowEdit(true)}>Edit</button>
        )}
      </nav>

      {loading ? (
        <div className="loading"><div className="spinner" /><div>Loading…</div></div>
      ) : initiative ? (
        <div className="details-body">
          <div className="dp-hero-card">
            <div className="dp-hero-right" style={{ width: '100%' }}>
              <div className="dp-hero-title">{initiative.project_name}</div>
              <div className="dp-hero-meta" style={{ display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span className={`pill ${diStatusClass(initiative.status)}`}><span className="d" />{initiative.status}</span>
                <span>Tier: {initiative.tier}</span>
                <span>Owner: {initiative.owner || '—'}</span>
                {initiative.queue_number != null && <span>Queue #{initiative.queue_number}</span>}
                {initiative.overdue && <span style={{ color: 'var(--danger, #C0392B)', fontWeight: 700 }}>⚠ Overdue</span>}
              </div>

              <div className="dp-date-boxes">
                <div className="dp-date-box">
                  <div className="dp-date-box-label">RICE SCORE</div>
                  <div className="dp-date-box-value">{initiative.rice_score != null ? initiative.rice_score.toFixed(2) : '—'}</div>
                </div>
                <div className="dp-date-box">
                  <div className="dp-date-box-label">DEPLOY TARGET</div>
                  <div className="dp-date-box-value">{initiative.deploy_target ? fmt(initiative.deploy_target) : '—'}</div>
                </div>
                <div className="dp-date-box">
                  <div className="dp-date-box-label">DATE START</div>
                  <div className="dp-date-box-value">{initiative.date_start ? fmt(initiative.date_start) : '—'}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="dp-notes-block">
            <div className="dp-notes-label">Stage Timeline</div>
            <StageTimelineBar history={history} expanded />
          </div>

          {initiative.description && (
            <div className="dp-notes-block">
              <div className="dp-notes-label">Description</div>
              <div>{initiative.description}</div>
            </div>
          )}

          <div className="dp-notes-block">
            <div className="dp-notes-label">Flag a Delay — Blocker Reason</div>
            <p style={{ fontSize: '.72rem', color: 'var(--text-3)', marginBottom: '.5rem' }}>
              Explains why the current stage is taking longer than expected — independent of status.
            </p>
            <select value={blockerCategory} onChange={e => setBlockerCategory(e.target.value)} style={{ marginBottom: '.5rem' }}>
              <option value="">— No blocker —</option>
              {BLOCKER_CATEGORIES.map(c => <option key={c} value={c}>{BLOCKER_LABEL[c]}</option>)}
            </select>
            <textarea
              placeholder="Note — who/what it's actually waiting on…"
              value={blockerNote}
              onChange={e => setBlockerNote(e.target.value)}
              rows={2}
            />
            <button className="btn btn-grad btn-sm" style={{ marginTop: '.5rem' }} onClick={saveBlocker} disabled={savingBlocker}>
              {savingBlocker ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <div className="details-body">Not found.</div>
      )}

      {showEdit && initiative && (
        <EditDIInitiativeModal
          initiative={initiative}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); load(); onRefresh() }}
        />
      )}
    </div>
  )
}
