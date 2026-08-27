'use client'

import { useEffect, useState } from 'react'
import { DiInitiative, Initiative } from '@/types'
import {
  STATUS_VALUES, SIZE_VALUES, TIER_VALUES, TYPE_VALUES, ARCHITECT_VALUES, OWNER_VALUES,
  PRIORITY_VALUES, BLOCKER_CATEGORIES,
} from '@/lib/di-scheduling'

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

// Size Preset is editable per project after creation (lexicon.md), and unlike
// creation there's no "only send weeks when Custom" shortcut — the five stage-week
// fields are always shown and always sent, since an existing project's estimates
// are precise per-project numbers by the time anyone is editing them, not just a
// size-preset default. The size_preset value itself is kept as a display label.
export default function EditDIInitiativeModal({ initiative, onClose, onSaved }: Props) {
  const [initiatives, setInitiatives] = useState<Initiative[]>([])
  const [form, setForm] = useState({
    project_name: initiative.project_name ?? '',
    status: initiative.status ?? 'Backlog',
    status_note: initiative.status_note ?? '',
    size_preset: initiative.size_preset ?? 'Medium',
    tier: initiative.tier ?? TIER_VALUES[0],
    type: initiative.type ?? TYPE_VALUES[0],
    architect: initiative.architect ?? ARCHITECT_VALUES[2],
    owner: initiative.owner ?? OWNER_VALUES[3],
    priority: initiative.priority ?? PRIORITY_VALUES[1],
    rice_r: initiative.rice_r != null ? String(initiative.rice_r) : '',
    rice_i: initiative.rice_i != null ? String(initiative.rice_i) : '',
    rice_c: initiative.rice_c != null ? String(initiative.rice_c) : '',
    description: initiative.description ?? '',
    link: initiative.link ?? '',
    tracker_initiative_id: initiative.tracker_initiative_id ?? '',
    design_wks: String(initiative.design_wks ?? 0),
    build_wks: String(initiative.build_wks ?? 0),
    qa_wks: String(initiative.qa_wks ?? 0),
    approval_wks: String(initiative.approval_wks ?? 0),
    deploy_wks: String(initiative.deploy_wks ?? 0),
    blocker_category: '',
    blocker_note: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/initiatives').then(r => r.json()).then(data => setInitiatives(Array.isArray(data) ? data : []))
  }, [])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  // Blocker category + note are only required when this save is the transition
  // INTO Blocked (ADR history side-effect model) — editing an already-Blocked
  // project's other fields doesn't force re-entering them.
  const movingToBlocked = form.status === 'Blocked' && initiative.status !== 'Blocked'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.project_name.trim()) { setError('Project name is required.'); return }
    if (movingToBlocked && !form.blocker_category) { setError('Blocker category is required when moving to Blocked.'); return }
    if (movingToBlocked && !form.blocker_note.trim()) { setError('Blocker note is required when moving to Blocked.'); return }
    setSaving(true)
    setError('')

    const body: Record<string, unknown> = {
      project_name: form.project_name.trim(),
      status: form.status,
      status_note: form.status_note,
      size_preset: form.size_preset,
      tier: form.tier,
      type: form.type,
      architect: form.architect,
      owner: form.owner,
      priority: form.priority,
      description: form.description,
      link: form.link,
      tracker_initiative_id: form.tracker_initiative_id || null,
      design_wks: Number(form.design_wks),
      build_wks: Number(form.build_wks),
      qa_wks: Number(form.qa_wks),
      approval_wks: Number(form.approval_wks),
      deploy_wks: Number(form.deploy_wks),
      rice_r: form.rice_r === '' ? null : Number(form.rice_r),
      rice_i: form.rice_i === '' ? null : Number(form.rice_i),
      rice_c: form.rice_c === '' ? null : Number(form.rice_c),
    }
    if (movingToBlocked) {
      body.blocker_category = form.blocker_category
      body.blocker_note = form.blocker_note.trim()
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
      <div className="modal">
        <h3>Edit D+I Project</h3>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <label className="modal-label">Project Name <span className="req">*</span></label>
            <input type="text" value={form.project_name} onChange={e => set('project_name', e.target.value)} autoFocus />

            <div className="modal-row">
              <div>
                <label className="modal-label">Status</label>
                <select value={form.status} onChange={e => set('status', e.target.value)}>
                  {STATUS_VALUES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="modal-label">Size Preset</label>
                <select value={form.size_preset} onChange={e => set('size_preset', e.target.value)}>
                  {SIZE_VALUES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {movingToBlocked && (
              <>
                <label className="modal-label">Blocker Category <span className="req">*</span></label>
                <select value={form.blocker_category} onChange={e => set('blocker_category', e.target.value)}>
                  <option value="">— Select —</option>
                  {BLOCKER_CATEGORIES.map(c => <option key={c} value={c}>{BLOCKER_LABEL[c]}</option>)}
                </select>

                <label className="modal-label">Blocker Note <span className="req">*</span></label>
                <textarea placeholder="What's blocking this?" value={form.blocker_note} onChange={e => set('blocker_note', e.target.value)} rows={2} />
              </>
            )}

            <label className="modal-label">Status Note</label>
            <input type="text" placeholder="Optional note about current status…" value={form.status_note} onChange={e => set('status_note', e.target.value)} />

            <div className="modal-row" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: '.5rem' }}>
              <div>
                <label className="modal-label">Design wks</label>
                <input type="number" step="0.5" min="0" value={form.design_wks} onChange={e => set('design_wks', e.target.value)} />
              </div>
              <div>
                <label className="modal-label">Build wks</label>
                <input type="number" step="0.5" min="0" value={form.build_wks} onChange={e => set('build_wks', e.target.value)} />
              </div>
              <div>
                <label className="modal-label">QA wks</label>
                <input type="number" step="0.5" min="0" value={form.qa_wks} onChange={e => set('qa_wks', e.target.value)} />
              </div>
              <div>
                <label className="modal-label">Approval wks</label>
                <input type="number" step="0.5" min="0" value={form.approval_wks} onChange={e => set('approval_wks', e.target.value)} />
              </div>
              <div>
                <label className="modal-label">Deploy wks</label>
                <input type="number" step="0.5" min="0" value={form.deploy_wks} onChange={e => set('deploy_wks', e.target.value)} />
              </div>
            </div>

            <div className="modal-row">
              <div>
                <label className="modal-label">Tier</label>
                <select value={form.tier} onChange={e => set('tier', e.target.value)}>
                  {TIER_VALUES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="modal-label">Type</label>
                <select value={form.type} onChange={e => set('type', e.target.value)}>
                  {TYPE_VALUES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div className="modal-row">
              <div>
                <label className="modal-label">Architect</label>
                <select value={form.architect} onChange={e => set('architect', e.target.value)}>
                  {ARCHITECT_VALUES.map(a => <option key={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="modal-label">Owner</label>
                <select value={form.owner} onChange={e => set('owner', e.target.value)}>
                  {OWNER_VALUES.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>

            <label className="modal-label">Priority</label>
            <select value={form.priority} onChange={e => set('priority', e.target.value)}>
              {PRIORITY_VALUES.map(p => <option key={p}>{p}</option>)}
            </select>

            <label className="modal-label">RICE Score Inputs</label>
            <div className="modal-row" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
              <div>
                <label className="modal-label">Reach</label>
                <input type="number" step="1" value={form.rice_r} onChange={e => set('rice_r', e.target.value)} />
              </div>
              <div>
                <label className="modal-label">Impact</label>
                <input type="number" step="1" value={form.rice_i} onChange={e => set('rice_i', e.target.value)} />
              </div>
              <div>
                <label className="modal-label">Confidence %</label>
                <input type="number" step="1" min="0" max="100" value={form.rice_c} onChange={e => set('rice_c', e.target.value)} />
              </div>
            </div>

            <label className="modal-label">Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} />

            <label className="modal-label">Link</label>
            <input type="text" value={form.link} onChange={e => set('link', e.target.value)} />

            <label className="modal-label">Tracker Initiative Link</label>
            <select value={form.tracker_initiative_id} onChange={e => set('tracker_initiative_id', e.target.value)}>
              <option value="">— None —</option>
              {initiatives.map(i => <option key={i.id} value={i.id}>{i.task_name}</option>)}
            </select>

            {error && <p style={{ color: 'var(--danger)', fontSize: '.8rem', marginBottom: '.5rem' }}>{error}</p>}
          </div>

          <div className="modal-foot">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-grad" disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
