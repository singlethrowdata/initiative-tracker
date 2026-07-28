'use client'

import { useEffect, useState } from 'react'
import { DiInitiative } from '@/types'
import { IN_FLIGHT_STATUSES, avgApprovalDays } from '@/lib/di-scheduling'

interface Props {
  initiatives: DiInitiative[]
}

// "TBD"/"Other"/"Both" aren't a person with a WIP cap — a slot indicator for them would
// be meaningless noise (this bug shipped once already this session, not repeating it).
const PLACEHOLDER_OWNERS = ['TBD', 'Other', 'Both', '']

// Compact always-visible capacity strip — replaces the earlier card-grid. Per-owner WIP
// slots (filled/at-cap) + queued count, plus org-wide Awaiting Approval turnaround.
export default function CapacityStrip({ initiatives }: Props) {
  const [config, setConfig] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch('/api/di-config').then(r => r.json()).then(setConfig)
  }, [])

  const wipCap = Number(config.wip_cap_per_owner ?? 4)
  const owners = Array.from(new Set(initiatives.map(i => i.owner))).filter(o => !PLACEHOLDER_OWNERS.includes(o))

  const waiting = initiatives.filter(i => i.status === 'Awaiting Approval')
  const avgApproval = avgApprovalDays(initiatives)

  return (
    <div className="di-capstrip">
      <span className="di-capstrip-label">Capacity</span>
      {owners.map(owner => {
        const wip = initiatives.filter(i => i.owner === owner && IN_FLIGHT_STATUSES.includes(i.status)).length
        const queued = initiatives.filter(i => i.owner === owner && i.status === 'In Queue').length
        const atCap = wip >= wipCap
        return (
          <span key={owner} className="di-capstrip-owner">
            <span>{owner.split(' ')[0]}</span>
            <span className="di-slots">
              {Array.from({ length: wipCap }, (_, i) => (
                <span key={i} className={`di-slot ${i < wip ? (atCap ? 'at-cap' : 'filled') : ''}`} />
              ))}
            </span>
            <span style={{ fontSize: '.66rem', color: 'var(--text-3)' }}>{wip}/{wipCap} · {queued} queued</span>
          </span>
        )
      })}
      <span className="di-capstrip-owner" style={{ marginLeft: 'auto' }}>
        <span style={{ fontSize: '.66rem', color: 'var(--text-3)' }}>
          {waiting.length} in approval · {avgApproval != null ? avgApproval.toFixed(1) : '0'}d avg
        </span>
      </span>
    </div>
  )
}
