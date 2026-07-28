'use client'

import { useState } from 'react'
import { DiInitiative } from '@/types'
import { STATUS_VALUES, TIER_VALUES, TYPE_VALUES, ARCHITECT_VALUES, OWNER_VALUES, PRIORITY_VALUES, ESTIMATE_BUFFER } from '@/lib/di-scheduling'
import TrackerLinkPicker from '@/components/tabs/di/TrackerLinkPicker'
import SizePicker from '@/components/tabs/di/SizePicker'

interface Props {
  initiative: DiInitiative
  onClose: () => void
  onSaved: () => void
}

export default function EditDIInitiativeModal({ initiative, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    project_name: initiative.project_name ?? '',
    tier: initiative.tier ?? TIER_VALUES[2],
    type: initiative.type ?? 'Other',
    architect: initiative.architect ?? ARCHITECT_VALUES[2],
    owner: initiative.owner ?? OWNER_VALUES[3],
    status: initiative.status ?? 'Backlog',
    priority: initiative.priority ?? 'Medium',
    description: initiative.description ?? '',
    outcome: initiative.outcome ?? '',
    link: initiative.link ?? '',
    pace_id: initiative.pace_id ?? '',
    accelo_id: initiative.accelo_id ?? '',
    rice_r: initiative.rice_r != null ? String(initiative.rice_r) : '',
    rice_i: initiative.rice_i != null ? String(initiative.rice_i) : '',
    rice_c: initiative.rice_c != null ? String(initiative.rice_c) : '',
    design_wks: String(initiative.design_wks ?? 0),
    build_wks: String(initiative.build_wks ?? 0),
    qa_wks: String(initiative.qa_wks ?? 0),
    approval_wks: String(initiative.approval_wks ?? 0),
    deploy_wks: String(initiative.deploy_wks ?? 0),
  })
  const [trackerInitiativeId, setTrackerInitiativeId] = useState<string | null>(initiative.tracker_initiative_id)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.project_name.trim()) { setError('Project name is required.'); return }
    setSaving(true)
    setError('')

    const res = await fetch(`/api/di-initiatives/${initiative.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        rice_r: form.rice_r ? Number(form.rice_r) : null,
        rice_i: form.rice_i ? Number(form.rice_i) : null,
        rice_c: form.rice_c ? Number(form.rice_c) : null,
        design_wks: Number(form.design_wks) || 0,
        build_wks: Number(form.build_wks) || 0,
        qa_wks: Number(form.qa_wks) || 0,
        approval_wks: Number(form.approval_wks) || 0,
        deploy_wks: Number(form.deploy_wks) || 0,
        tracker_initiative_id: trackerInitiativeId,
      }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'Failed to save. Please try again.')
      setSaving(false)
      return
    }
    onSaved()
  }

  return (
    <div className="overlay show" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <h3>Edit D+I Initiative</h3>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <label className="modal-label">Project Name <span className="req">*</span></label>
            <input type="text" value={form.project_name} onChange={e => set('project_name', e.target.value)} autoFocus />

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

            <div className="modal-row">
              <div>
                <label className="modal-label">Status</label>
                <select value={form.status} onChange={e => set('status', e.target.value)}>
                  {STATUS_VALUES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="modal-label">Priority</label>
                <select value={form.priority} onChange={e => set('priority', e.target.value)}>
                  {PRIORITY_VALUES.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <p style={{ fontSize: '.68rem', color: 'var(--text-3)', marginTop: '-.5rem', marginBottom: '.75rem' }}>
              Current Queue #: {initiative.queue_number ?? '—'} (computed from Priority and RICE Score, not editable here).
            </p>

            <label className="modal-label">Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} />

            <label className="modal-label">Outcome</label>
            <textarea value={form.outcome} onChange={e => set('outcome', e.target.value)} rows={2} />

            <label className="modal-label">Link to Document</label>
            <input type="text" value={form.link} onChange={e => set('link', e.target.value)} />

            <div className="modal-row">
              <div>
                <label className="modal-label">PACE ID</label>
                <input type="text" value={form.pace_id} onChange={e => set('pace_id', e.target.value)} />
              </div>
              <div>
                <label className="modal-label">Accelo ID</label>
                <input type="text" value={form.accelo_id} onChange={e => set('accelo_id', e.target.value)} />
              </div>
            </div>

            <label className="modal-label">RICE Inputs</label>
            <div className="modal-row" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
              <input type="number" placeholder="Reach (R)" value={form.rice_r} onChange={e => set('rice_r', e.target.value)} />
              <input type="number" placeholder="Impact (I)" value={form.rice_i} onChange={e => set('rice_i', e.target.value)} />
              <input type="number" placeholder="Confidence % (C)" value={form.rice_c} onChange={e => set('rice_c', e.target.value)} />
            </div>

            <label className="modal-label">Phase Weeks (Design / Build / QA / Approval / Deploy)</label>
            <SizePicker onPick={preset => setForm(f => ({
              ...f,
              design_wks: String(preset.design),
              build_wks: String(preset.build),
              qa_wks: String(preset.qa),
              approval_wks: String(preset.approval),
              deploy_wks: String(preset.deploy),
            }))} />
            <div className="modal-row" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', marginTop: '.5rem' }}>
              <input type="number" step="0.5" placeholder="Design" value={form.design_wks} onChange={e => set('design_wks', e.target.value)} />
              <input type="number" step="0.5" placeholder="Build" value={form.build_wks} onChange={e => set('build_wks', e.target.value)} />
              <input type="number" step="0.5" placeholder="QA" value={form.qa_wks} onChange={e => set('qa_wks', e.target.value)} />
              <input type="number" step="0.5" placeholder="Approval" value={form.approval_wks} onChange={e => set('approval_wks', e.target.value)} />
              <input type="number" step="0.5" placeholder="Deploy" value={form.deploy_wks} onChange={e => set('deploy_wks', e.target.value)} />
            </div>
            <p style={{ fontSize: '.68rem', color: 'var(--text-3)', marginTop: '-.5rem', marginBottom: '.75rem' }}>
              Enter your best-guess estimate — scheduling automatically pads each by {Math.round((ESTIMATE_BUFFER - 1) * 100)}% to account for the usual optimism gap.
              {(Number(form.design_wks) || Number(form.build_wks) || Number(form.qa_wks) || Number(form.approval_wks) || Number(form.deploy_wks)) > 0 && (
                <> Padded: {(Number(form.design_wks || 0) * ESTIMATE_BUFFER).toFixed(1)} / {(Number(form.build_wks || 0) * ESTIMATE_BUFFER).toFixed(1)} / {(Number(form.qa_wks || 0) * ESTIMATE_BUFFER).toFixed(1)} / {(Number(form.approval_wks || 0) * ESTIMATE_BUFFER).toFixed(1)} / {(Number(form.deploy_wks || 0) * ESTIMATE_BUFFER).toFixed(1)} wks.</>
              )}
            </p>

            <label className="modal-label">Link to Tracker Initiative</label>
            <TrackerLinkPicker value={trackerInitiativeId} onChange={(id) => setTrackerInitiativeId(id)} />

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
