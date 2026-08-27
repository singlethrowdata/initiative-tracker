'use client'

import { useEffect, useState } from 'react'
import { Initiative } from '@/types'
import {
  SIZE_VALUES, TIER_VALUES, TYPE_VALUES, ARCHITECT_VALUES, OWNER_VALUES, PRIORITY_VALUES,
} from '@/lib/di-scheduling'

interface Props {
  onClose: () => void
  onCreated: () => void
}

export default function CreateDIInitiativeModal({ onClose, onCreated }: Props) {
  const [initiatives, setInitiatives] = useState<Initiative[]>([])
  const [form, setForm] = useState({
    project_name: '',
    size_preset: 'Medium',
    tier: TIER_VALUES[0],
    type: TYPE_VALUES[0],
    architect: ARCHITECT_VALUES[2],
    owner: OWNER_VALUES[3],
    priority: PRIORITY_VALUES[1],
    rice_r: '',
    rice_i: '',
    rice_c: '',
    description: '',
    link: '',
    tracker_initiative_id: '',
    design_wks: '',
    build_wks: '',
    qa_wks: '',
    approval_wks: '',
    deploy_wks: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/initiatives').then(r => r.json()).then(data => setInitiatives(Array.isArray(data) ? data : []))
  }, [])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.project_name.trim()) { setError('Project name is required.'); return }
    if (form.size_preset === 'Custom') {
      const weeks = [form.design_wks, form.build_wks, form.qa_wks, form.approval_wks, form.deploy_wks]
      if (weeks.some(w => w.trim() === '' || Number.isNaN(Number(w)))) {
        setError('All five stage-week estimates are required for a custom size.')
        return
      }
    }
    setSaving(true)
    setError('')

    const body: Record<string, unknown> = {
      project_name: form.project_name.trim(),
      size_preset: form.size_preset,
      tier: form.tier,
      type: form.type,
      architect: form.architect,
      owner: form.owner,
      priority: form.priority,
      description: form.description,
      link: form.link,
    }
    if (form.rice_r !== '') body.rice_r = Number(form.rice_r)
    if (form.rice_i !== '') body.rice_i = Number(form.rice_i)
    if (form.rice_c !== '') body.rice_c = Number(form.rice_c)
    if (form.tracker_initiative_id) body.tracker_initiative_id = form.tracker_initiative_id
    if (form.size_preset === 'Custom') {
      body.design_wks = Number(form.design_wks)
      body.build_wks = Number(form.build_wks)
      body.qa_wks = Number(form.qa_wks)
      body.approval_wks = Number(form.approval_wks)
      body.deploy_wks = Number(form.deploy_wks)
    }

    const res = await fetch('/api/di-initiatives', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) { setError('Failed to create. Please try again.'); setSaving(false); return }
    onCreated()
  }

  return (
    <div className="overlay show" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <h3>New D+I Project</h3>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <label className="modal-label">Project Name <span className="req">*</span></label>
            <input type="text" placeholder="Project name…" value={form.project_name} onChange={e => set('project_name', e.target.value)} autoFocus />

            <label className="modal-label">Size Preset <span className="req">*</span></label>
            <select value={form.size_preset} onChange={e => set('size_preset', e.target.value)}>
              {SIZE_VALUES.map(s => <option key={s}>{s}</option>)}
            </select>

            {form.size_preset === 'Custom' && (
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
            )}

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
            <textarea placeholder="What is this project about?" value={form.description} onChange={e => set('description', e.target.value)} rows={3} />

            <label className="modal-label">Link</label>
            <input type="text" placeholder="https://…" value={form.link} onChange={e => set('link', e.target.value)} />

            <label className="modal-label">Tracker Initiative Link</label>
            <select value={form.tracker_initiative_id} onChange={e => set('tracker_initiative_id', e.target.value)}>
              <option value="">&mdash; None &mdash;</option>
              {initiatives.map(i => <option key={i.id} value={i.id}>{i.task_name}</option>)}
            </select>

            {error && <p style={{ color: 'var(--danger)', fontSize: '.8rem', marginBottom: '.5rem' }}>{error}</p>}
          </div>

          <div className="modal-foot">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-grad" disabled={saving}>
              {saving ? 'Creating…' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
