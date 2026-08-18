'use client'

import { useEffect, useState } from 'react'
import { DiInitiative } from '@/types'
import { IN_FLIGHT_STATUSES, avgApprovalDays } from '@/lib/di-scheduling'

interface Props {
  initiatives: DiInitiative[]
}

// "TBD"/"Other"/"Both" aren't a person with a WIP cap — a slot indicator for them would
// be meaningless noise.
const PLACEHOLDER_OWNERS = ['TBD', 'Other', 'Both', '']

// The entire "how backed up are we" answer in one scannable row — replaces the old
// separate Stage Band + Capacity Strip. Four counts anyone (not just D+I) can read in a
// couple seconds, plus per-owner WIP load on the right for the team's own working view.
export default function InsightBar({ initiatives }: Props) {
  const [config, setConfig] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch('/api/di-config').then(r => r.json()).then(setConfig)
  }, [])

  const wipCap = Number(config.wip_cap_per_owner ?? 4)

  const backlog = initiatives.filter(i => i.status === 'Backlog' || i.status === 'In Queue')
  const inFlight = initiatives.filter(i => IN_FLIGHT_STATUSES.includes(i.status))
  const approval = initiatives.filter(i => i.status === 'Awaiting Approval')
  const avgApproval = avgApprovalDays(initiatives)
  // "Needs attention": literally Blocked/Paused, or held in place mid-stage via a
  // tagged Blocker Reason without a status change (see mirrorWaitingOnToRoadmap) — both
  // are the same "nothing's moving" signal, just at different points in the pipeline.
  const needsAttention = initiatives.filter(i =>
    i.status === 'Blocked' || i.status === 'Paused' || !!i.history.find(h => !h.exited_at)?.blocker_category
  )

  const owners = Array.from(new Set(initiatives.map(i => i.owner))).filter(o => !PLACEHOLDER_OWNERS.includes(o))

  return (
    <div className="di-insight">
      <div className="di-insight-stats">
        <Stat label="Backlog" value={backlog.length} />
        <Stat label="In Flight" value={inFlight.length} />
        <Stat label="Awaiting Approval" value={approval.length} sub={avgApproval != null ? `${avgApproval.toFixed(1)}d avg turnaround` : undefined} />
        <Stat label="Needs Attention" value={needsAttention.length} danger={needsAttention.length > 0} />
      </div>
      <div className="di-insight-owners">
        {owners.map(owner => {
          const wip = initiatives.filter(i => i.owner === owner && IN_FLIGHT_STATUSES.includes(i.status)).length
          const queued = initiatives.filter(i => i.owner === owner && i.status === 'In Queue').length
          const atCap = wip >= wipCap
          return (
            <span key={owner} className={`di-owner-chip${atCap ? ' at-cap' : ''}`}>
              <b>{owner.split(' ')[0]}</b> {wip}/{wipCap}{queued > 0 ? ` · ${queued} queued` : ''}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function Stat({ label, value, sub, danger }: { label: string; value: number; sub?: string; danger?: boolean }) {
  return (
    <div className={`di-stat${danger ? ' danger' : ''}`}>
      <p className="di-stat-value">{value}</p>
      <p className="di-stat-label">{label}</p>
      {sub && <p className="di-stat-sub">{sub}</p>}
    </div>
  )
}
