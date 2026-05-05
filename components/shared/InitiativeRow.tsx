'use client'

import { useState } from 'react'
import { Initiative, TeamMember } from '@/types'
import { statusClass, priorityClass, fmt, parseLinks } from '@/lib/ui'
import UpdatesExpand from '@/components/shared/UpdatesExpand'

interface Props {
  initiative: Initiative & { updates?: any[] }
  user: { email: string; name: string }
  canDelete: boolean
  teamList: TeamMember[]
  onOpen: () => void
  onStatusChange: (id: string, status: string) => void
  onDelete: (id: string) => void
  onComplete: () => void
  onRefresh: () => void
}

const STATUSES = ['Not Started', 'In Progress', 'Planning', 'Blocked', 'Awaiting Approval', 'Approved']

export default function InitiativeRow({
  initiative: i, user, canDelete, teamList,
  onOpen, onStatusChange, onDelete, onComplete, onRefresh,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const links = parseLinks(i.links ?? '')
  const isOwner = i.created_by === user.email

  return (
    <>
      <tr className={expanded ? 'expanded-parent' : ''}>
        <td style={{ textAlign: 'center' }}>
          <button
            className={`expand-toggle${expanded ? ' open' : ''}`}
            onClick={() => setExpanded(v => !v)}
            title={expanded ? 'Collapse' : 'Expand updates'}
          >
            <svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></svg>
          </button>
        </td>

        <td>
          <button className="init-name-link" onClick={onOpen}>{i.task_name}</button>
          {i.department && <div className="creator-badge">{i.department}</div>}
        </td>

        <td className="td-no-clip">
          <select
            className={`inline-select pill ${statusClass(i.status)}`}
            value={i.status}
            onChange={e => onStatusChange(i.id, e.target.value)}
          >
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </td>

        <td>
          <span className={`${priorityClass(i.priority)}`} style={{ fontWeight: 700, fontSize: '.72rem' }}>
            {i.priority}
          </span>
        </td>

        <td style={{ fontSize: '.72rem' }}>{i.type}</td>
        <td style={{ fontSize: '.72rem' }}>{i.department}</td>

        <td>
          {i.waiting_on ? (
            <span className="ut-waiting-chip">{i.waiting_on}</span>
          ) : (
            <span style={{ color: 'var(--text-3)', fontSize: '.68rem' }}>—</span>
          )}
        </td>

        <td style={{ fontSize: '.72rem' }}>
          {i.anticipated_end_date ? fmt(i.anticipated_end_date) : '—'}
        </td>

        <td>
          <div style={{ fontSize: '.72rem', color: 'var(--text-2)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {i.description?.slice(0, 80) || '—'}
          </div>
          {links.length > 0 && (
            <div className="links-stack" style={{ marginTop: 3 }}>
              {links.slice(0, 2).map((url, k) => (
                <a key={k} href={url} target="_blank" rel="noreferrer" className="link-chip">
                  ↗ {url.replace(/^https?:\/\//, '').slice(0, 30)}
                </a>
              ))}
            </div>
          )}
        </td>

        <td>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {(isOwner || canDelete) && (
              <button className="btn btn-green btn-xs" onClick={onComplete}>Complete</button>
            )}
            {canDelete && (
              <button className="btn btn-danger-o btn-xs" onClick={() => onDelete(i.id)}>Delete</button>
            )}
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="expand-row">
          <td colSpan={10}>
            <div className="expand-inner">
              <UpdatesExpand
                initiative={i}
                user={user}
                teamList={teamList}
                onRefresh={onRefresh}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
