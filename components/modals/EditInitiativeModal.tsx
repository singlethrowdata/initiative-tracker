'use client'

import { useState } from 'react'
import { Initiative, TeamMember } from '@/types'
import ParticipantSelect from '@/components/shared/ParticipantSelect'

interface Props {
  initiative: Initiative
  teamList: TeamMember[]
  onClose: () => void
  onSaved: () => void
}

const TYPES = ['Project', 'Process', 'Training', 'Research', 'Other']
const PRIORITIES = ['High', 'Medium', 'Low']
const STATUSES = ['Not Started', 'In Progress', 'Planning', 'Blocked', 'Awaiting Approval', 'Approved']
const DEPARTMENTS = ['Operations', 'Content', 'SEO', 'Design', 'CRO', 'Data & Innovation', 'Account Managers', 'Sales', 'Finance', 'Paid', 'Executive Assistant', 'Organization']

export default function EditInitiativeModal({ initiative, teamList, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    task_name: initiative.task_name ?? '',
    type: initiative.type ?? 'Project',
    priority: initiative.priority ?? 'Medium',
    status: initiative.status ?? 'Not Started',
    department: initiative.department ?? '',
    description: initiative.description ?? '',
    notes: initiative.notes ?? '',
    participants: initiative.participants ?? '',
    links: initiative.links ?? '',
    start_date: initiative.start_date ? String(initiative.start_date).slice(0, 10) : '',
    anticipated_end_date: initiative.anticipated_end_date ? String(initiative.anticipated_end_date).slice(0, 10) : '',
    waiting_on: initiative.waiting_on ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.task_name.trim()) { setError('Initiative name is required.'); return }
    setSaving(true)
    setError('')
    const res = await fetch(`/api/initiatives/${initiative.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (!res.ok) { setError('Failed to save. Please try again.'); setSaving(false); return }
    onSaved()
  }

  return (
    <div className="overlay show" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <h3>Edit Initiative</h3>
        <form onSubmit={handleSubmit}>
          <label className="modal-label">Name <span className="req">*</span></label>
          <input type="text" placeholder="Initiative name…" value={form.task_name} onChange={e => set('task_name', e.target.value)} autoFocus />

          <div className="modal-row">
            <div>
              <label className="modal-label">Type</label>
              <select value={form.type} onChange={e => set('type', e.target.value)}>
                {TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="modal-label">Priority</label>
              <select value={form.priority} onChange={e => set('priority', e.target.value)}>
                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div className="modal-row">
            <div>
              <label className="modal-label">Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="modal-label">Department</label>
              <select value={form.department} onChange={e => set('department', e.target.value)}>
                <option value="">— Select —</option>
                {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div className="modal-row">
            <div>
              <label className="modal-label">Start Date</label>
              <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
            </div>
            <div>
              <label className="modal-label">Target End Date</label>
              <input type="date" value={form.anticipated_end_date} onChange={e => set('anticipated_end_date', e.target.value)} />
            </div>
          </div>

          <label className="modal-label">Participants</label>
          <ParticipantSelect teamList={teamList} value={form.participants} onChange={v => set('participants', v)} />

          <label className="modal-label">Description</label>
          <textarea placeholder="What is this initiative about?" value={form.description} onChange={e => set('description', e.target.value)} rows={3} />

          <label className="modal-label">Notes</label>
          <textarea placeholder="Internal notes…" value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />

          <label className="modal-label">Waiting On</label>
          <select value={form.waiting_on} onChange={e => set('waiting_on', e.target.value)}>
            <option value="">— None —</option>
            {teamList.map(m => <option key={m.email} value={m.display_name}>{m.display_name}</option>)}
          </select>

          <label className="modal-label">Links</label>
          <input type="text" placeholder="https://… (separate multiple with commas)" value={form.links} onChange={e => set('links', e.target.value)} />

          {error && <p style={{ color: 'var(--danger)', fontSize: '.8rem', marginBottom: '.5rem' }}>{error}</p>}

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
