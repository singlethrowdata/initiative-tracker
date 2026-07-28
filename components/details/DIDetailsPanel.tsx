'use client'

import { useState, useEffect } from 'react'
import { DiInitiative } from '@/types'
import {
  ACTIVE_PIPELINE_STATUSES, OWNER_VALUES, PRIORITY_VALUES, BLOCKER_CATEGORIES,
  elapsedDays, estimatedTotalDays, stageCountdown, stageEstimateDays,
} from '@/lib/di-scheduling'
import StageTimelineBar from '@/components/tabs/di/StageTimelineBar'

interface UpdateRow {
  id: string
  user_name: string
  content: string
  created_at: string
}

interface Props {
  initiative: DiInitiative | null
  onRefresh: () => void
  onEdit: () => void
  canDelete: boolean
  onDelete: () => void
}

const SHORT: Record<string, string> = {
  'In Queue': 'Queue', Design: 'Design', Build: 'Build', QA: 'QA', 'Awaiting Approval': 'Approval', Deploy: 'Deploy',
}
const BLOCKER_LABEL: Record<string, string> = {
  internal_capacity: 'Internal Capacity', pm_scheduling: 'PM / Meeting Scheduling',
  client_external: 'Client / External', other: 'Other',
}

async function patch(id: string, body: Record<string, unknown>) {
  await fetch(`/api/di-initiatives/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
}

// The context rail — always visible alongside List/Board/Timeline, not a full-screen
// slide-over. Three sub-tabs mirror the approved mockup exactly.
export default function DIDetailsPanel({ initiative, onRefresh, onEdit, canDelete, onDelete }: Props) {
  const [rtab, setRtab] = useState<'overview' | 'stages' | 'updates'>('overview')

  useEffect(() => { setRtab('overview') }, [initiative?.id])

  if (!initiative) {
    return <aside className="di-context-rail"><p className="di-context-empty">Pick an initiative to see its stages and updates.</p></aside>
  }

  const openStage = initiative.history.find(h => !h.exited_at)
  const countdown = stageCountdown(initiative.history, initiative)
  const elapsed = Math.round(elapsedDays(initiative.history))
  const estTotal = Math.round(estimatedTotalDays(initiative))

  return (
    <aside className="di-context-rail">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '.5rem' }}>
        <p className="di-context-title">
          {initiative.project_name}
          {openStage?.blocker_category && <span className="di-tag-hold">Held</span>}
        </p>
        <div style={{ display: 'flex', gap: '.3rem', flexShrink: 0 }}>
          <button className="icon-btn icon-btn-neutral" onClick={onEdit} title="Edit">
            <svg viewBox="0 0 24 24" style={{ width: 12, height: 12 }}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
          </button>
          {canDelete && (
            <button className="icon-btn" onClick={onDelete} title="Delete">
              <svg viewBox="0 0 24 24" style={{ width: 12, height: 12 }}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" /></svg>
            </button>
          )}
        </div>
      </div>
      <p className="di-context-meta">{initiative.tier} · {initiative.type} · {initiative.owner || 'Unassigned'}</p>

      <div className="di-rtabs">
        {(['overview', 'stages', 'updates'] as const).map(t => (
          <button key={t} className={`di-rtab ${rtab === t ? 'on' : ''}`} onClick={() => setRtab(t)}>
            {t === 'overview' ? 'Overview' : t === 'stages' ? 'Stages' : 'Updates'}
          </button>
        ))}
      </div>

      {rtab === 'overview' && (
        <OverviewTab initiative={initiative} countdown={countdown} elapsed={elapsed} estTotal={estTotal} onRefresh={onRefresh} />
      )}
      {rtab === 'stages' && <StagesTab initiative={initiative} onRefresh={onRefresh} />}
      {rtab === 'updates' && <UpdatesTab initiative={initiative} />}
    </aside>
  )
}

function OverviewTab({ initiative: d, countdown, elapsed, estTotal, onRefresh }: {
  initiative: DiInitiative
  countdown: { remaining: number; over: number } | null
  elapsed: number
  estTotal: number
  onRefresh: () => void
}) {
  const openStage = d.history.find(h => !h.exited_at)
  const [blockerCategory, setBlockerCategory] = useState(openStage?.blocker_category ?? '')
  const [blockerNote, setBlockerNote] = useState(openStage?.blocker_note ?? '')
  const [savingBlocker, setSavingBlocker] = useState(false)

  useEffect(() => {
    setBlockerCategory(openStage?.blocker_category ?? '')
    setBlockerNote(openStage?.blocker_note ?? '')
  }, [d.id, openStage?.blocker_category, openStage?.blocker_note])

  async function saveBlocker() {
    setSavingBlocker(true)
    await fetch(`/api/di-initiatives/${d.id}/blocker`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocker_category: blockerCategory || null, blocker_note: blockerNote || null }),
    })
    setSavingBlocker(false)
    onRefresh()
  }

  return (
    <div>
      <StageTimelineBar history={d.history} initiative={d} big />

      {openStage?.blocker_category && (
        <div className="di-hold-banner">
          <b>{BLOCKER_LABEL[openStage.blocker_category] ?? openStage.blocker_category}</b>
          {openStage.blocker_note && ` — ${openStage.blocker_note}`}
        </div>
      )}

      <div style={{ marginTop: '.8rem' }}>
        <p className="di-exp-heading">Flag a delay — Blocker Reason</p>
        <select className="di-est-input" style={{ width: '100%', marginBottom: '.35rem' }}
          value={blockerCategory} onChange={e => setBlockerCategory(e.target.value)}>
          <option value="">— No blocker —</option>
          {BLOCKER_CATEGORIES.map(c => <option key={c} value={c}>{BLOCKER_LABEL[c]}</option>)}
        </select>
        <textarea
          className="ta" style={{ width: '100%', minHeight: 44 }}
          placeholder="Note — who/what it's actually waiting on…"
          value={blockerNote} onChange={e => setBlockerNote(e.target.value)}
        />
        <button className="btn btn-outline btn-sm" style={{ marginTop: '.35rem' }} onClick={saveBlocker} disabled={savingBlocker}>
          {savingBlocker ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div className="di-field-grid" style={{ marginTop: '.8rem' }}>
        <div className="di-field"><p className="di-field-label">Stage</p><p className="di-field-value">{d.status}</p></div>
        <div className="di-field">
          <p className="di-field-label">{countdown && countdown.over > 0 ? 'Over estimate' : 'Until next stage'}</p>
          <p className="di-field-value">{countdown ? (countdown.over > 0 ? `${countdown.over}d` : `${countdown.remaining}d`) : '—'}</p>
        </div>
        <div className="di-field"><p className="di-field-label">Elapsed</p><p className="di-field-value">{elapsed}d</p></div>
        <div className="di-field"><p className="di-field-label">Estimated</p><p className="di-field-value">{estTotal}d</p></div>
      </div>

      <div className="di-field-grid">
        <div className="di-field">
          <p className="di-field-label">Owner</p>
          <select className="di-est-input" style={{ width: '100%' }} defaultValue={d.owner}
            onChange={async e => { await patch(d.id, { owner: e.target.value }); onRefresh() }}>
            {OWNER_VALUES.map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div className="di-field">
          <p className="di-field-label">Priority</p>
          <select className="di-est-input" style={{ width: '100%' }} defaultValue={d.priority}
            onChange={async e => { await patch(d.id, { priority: e.target.value }); onRefresh() }}>
            {PRIORITY_VALUES.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
      </div>

      <div className="di-field-grid">
        <div className="di-field"><p className="di-field-label">RICE</p><p className="di-field-value">{d.rice_score != null ? d.rice_score.toFixed(1) : '—'}</p></div>
        <div className="di-field"><p className="di-field-label">Queue</p><p className="di-field-value">#{d.queue_number ?? '—'}</p></div>
      </div>
    </div>
  )
}

function StagesTab({ initiative: d, onRefresh }: { initiative: DiInitiative; onRefresh: () => void }) {
  const FIELD: Record<string, keyof DiInitiative> = {
    Design: 'design_wks', Build: 'build_wks', QA: 'qa_wks', 'Awaiting Approval': 'approval_wks', Deploy: 'deploy_wks',
  }

  return (
    <div>
      <p style={{ fontSize: '.7rem', color: 'var(--text-2)', marginBottom: '.6rem' }}>
        Estimates carry the 33% padding buffer automatically. Change one and every number on the page follows.
      </p>
      {ACTIVE_PIPELINE_STATUSES.map(status => {
        const field = FIELD[status]
        const h = d.history.find(x => x.status === status)
        const actual = h ? Math.round(((h.exited_at ? new Date(h.exited_at).getTime() : Date.now()) - new Date(h.entered_at).getTime()) / 86_400_000) : null
        const wks = field ? Number(d[field] ?? 0) : null

        return (
          <div key={status} className="di-phase-row">
            <span>{SHORT[status]}{status === d.status && <span style={{ color: 'var(--text-3)', fontSize: '.62rem' }}> now</span>}</span>
            <span>
              {actual != null && <span className="di-phase-actual">{actual}d actual · </span>}
              {field ? (
                <input
                  className="di-est-input" type="number" min={0} step={0.5}
                  defaultValue={wks ?? 0}
                  onBlur={async e => { await patch(d.id, { [field]: Number(e.target.value) || 0 }); onRefresh() }}
                  aria-label={`${status} estimate in weeks`}
                />
              ) : '—'}
            </span>
          </div>
        )
      })}
      <div className="di-phase-row" style={{ borderTop: '1px solid var(--border-hover)', marginTop: '.3rem', paddingTop: '.5rem', fontWeight: 700 }}>
        <span>Total (est.)</span>
        <span>{Math.round(ACTIVE_PIPELINE_STATUSES.reduce((sum, s) => sum + (stageEstimateDays(d, s) ?? 0), 0))}d</span>
      </div>
    </div>
  )
}

function UpdatesTab({ initiative: d }: { initiative: DiInitiative }) {
  const [updates, setUpdates] = useState<UpdateRow[] | null>(null)
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)

  const load = () => fetch(`/api/di-initiatives/${d.id}/updates`).then(r => r.json()).then(rows => setUpdates(Array.isArray(rows) ? rows : []))
  useEffect(() => { load() }, [d.id])

  async function post() {
    if (!draft.trim()) return
    setPosting(true)
    await fetch(`/api/di-initiatives/${d.id}/updates`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: draft }),
    })
    setDraft('')
    setPosting(false)
    load()
  }

  return (
    <div>
      <ul className="di-mini-feed" style={{ fontSize: '.75rem' }}>
        {updates == null ? (
          <li style={{ color: 'var(--text-3)' }}>Loading…</li>
        ) : updates.length === 0 ? (
          <li style={{ color: 'var(--text-3)' }}>No updates yet. Post the first one.</li>
        ) : (
          updates.map(u => (
            <li key={u.id} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '.15rem', borderBottom: '1px solid var(--border)', padding: '.5rem 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '.68rem' }}>
                <strong>{u.user_name}</strong>
                <span style={{ color: 'var(--text-3)' }}>{new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              </div>
              <p style={{ margin: 0 }}>{u.content}</p>
            </li>
          ))
        )}
      </ul>
      <div style={{ marginTop: '.6rem' }}>
        <textarea
          className="ta" style={{ width: '100%', minHeight: 52 }}
          placeholder="What changed?"
          value={draft}
          onChange={e => setDraft(e.target.value)}
        />
        <button className="btn btn-outline btn-sm" style={{ marginTop: '.4rem' }} onClick={post} disabled={posting}>
          {posting ? 'Posting…' : 'Post update'}
        </button>
      </div>
    </div>
  )
}
