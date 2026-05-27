'use client'

import { Initiative, TeamMember } from '@/types'
import { statusClass, fmt } from '@/lib/ui'

interface Props {
  initiative: Initiative & { updates?: any[] }
  user: { email: string; name: string }
  canDelete: boolean
  teamList: TeamMember[]
  onOpen: () => void
  onEdit: () => void
  onStatusChange: (id: string, status: string) => void
  onDelete: (id: string) => void
  onComplete: () => void
  onRefresh: () => void
}

const STATUSES = ['Not Started', 'In Progress', 'Planning', 'Blocked', 'Awaiting Approval', 'Approved']

export default function InitiativeRow({
  initiative: i, user, canDelete,
  onOpen, onEdit, onStatusChange, onDelete, onComplete,
}: Props) {
  const isOwner = i.created_by === user.email
  const participants = (i.participants ?? '').split(',').map(s => s.trim()).filter(Boolean)

  return (
    <tr>
      <td className="td-no-clip" style={{ width: '11%' }}>
        <select
          className={`inline-select pill ${statusClass(i.status)}`}
          value={i.status}
          onChange={e => onStatusChange(i.id, e.target.value)}
        >
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
      </td>

      <td style={{ width: '18%' }}>
        <button className="init-name-link" onClick={onOpen}>{i.task_name}</button>
        {i.type && <div className="creator-badge">{i.type}</div>}
      </td>

      <td style={{ width: '35%' }}>
        <div className="init-desc">{i.description || '—'}</div>
      </td>

      <td style={{ width: '16%' }}>
        <div className="participant-chips">
          {participants.length > 0
            ? participants.map((p, k) => <span key={k} className="participant-chip">{p}</span>)
            : <span style={{ color: 'var(--text-3)', fontSize: '.68rem' }}>—</span>}
        </div>
      </td>

      <td style={{ width: '10%', fontSize: '.72rem', color: 'var(--text-2)' }}>
        {i.anticipated_end_date ? fmt(i.anticipated_end_date) : '—'}
      </td>

      <td style={{ width: '10%' }}>
        <div className="row-actions">
          <button className="icon-btn" onClick={onOpen} title="View details">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          </button>
          {i.status !== 'Awaiting Approval' && i.status !== 'Approved' && (
            <button className="icon-btn icon-btn-success" onClick={onComplete} title="Mark complete">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </button>
          )}
          <button className="icon-btn icon-btn-neutral" onClick={onEdit} title="Edit">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          {(isOwner || canDelete) && (
            <button className="icon-btn icon-btn-danger" onClick={() => onDelete(i.id)} title="Delete">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}
