'use client'

import { useEffect, useState } from 'react'
import { DiInitiative } from '@/types'
import { IN_FLIGHT_STATUSES } from '@/lib/di-scheduling'

interface Props {
  initiatives: DiInitiative[]
}

const phaseWeeks = (i: DiInitiative) => i.design_wks + i.build_wks + i.qa_wks + i.deploy_wks

// The EVPO's "how backed up are we" view — live, on demand, independent of the
// existing Weekly Summary (see lexicon.md "Capacity" and "Weekly Summary").
export default function CapacitySummary({ initiatives }: Props) {
  const [config, setConfig] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch('/api/di-config').then(r => r.json()).then(setConfig)
  }, [])

  const wipCap = Number(config.wip_cap_per_owner ?? 2)
  const highLoad = Number(config.high_load_weeks_threshold ?? 8)
  const overload = Number(config.overload_weeks_threshold ?? 12)

  const owners = Array.from(new Set(initiatives.map(i => i.owner).filter(Boolean)))

  const backlogAndQueue = initiatives.filter(i => i.status === 'Backlog' || i.status === 'In Queue')
  const oldestBacklogDays = backlogAndQueue.length
    ? Math.max(...backlogAndQueue.map(i => Math.round((Date.now() - new Date(i.created_at).getTime()) / 86_400_000)))
    : 0

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '.75rem', marginBottom: '1rem' }}>
        {owners.map(owner => {
          const mine = initiatives.filter(i => i.owner === owner)
          const inFlight = mine.filter(i => IN_FLIGHT_STATUSES.includes(i.status))
          const committedWeeks = mine
            .filter(i => IN_FLIGHT_STATUSES.includes(i.status) || i.status === 'In Queue')
            .reduce((sum, i) => sum + phaseWeeks(i), 0)
          const atCap = inFlight.length >= wipCap
          const cardClass = committedWeeks > overload ? 'overloaded' : committedWeeks > highLoad ? 'high-load' : ''

          return (
            <div key={owner} className={`di-cap-card ${cardClass}`}>
              <div style={{ fontWeight: 800, fontSize: '.85rem', marginBottom: '.4rem' }}>{owner}</div>
              <div style={{ fontSize: '.72rem', color: 'var(--text-3)' }}>
                In Flight: <strong>{inFlight.length}</strong> / {wipCap} {atCap && '⚠️ at cap'}
              </div>
              <div style={{ fontSize: '.72rem', color: 'var(--text-3)' }}>
                Committed weeks: <strong>{committedWeeks}</strong>
                {committedWeeks > overload && ' 🔴 overloaded'}
                {committedWeeks > highLoad && committedWeeks <= overload && ' 🟡 high load'}
              </div>
            </div>
          )
        })}
      </div>

      <div className="di-cap-card">
        <div style={{ fontWeight: 800, fontSize: '.85rem', marginBottom: '.4rem' }}>Backlog &amp; Queue</div>
        <div style={{ fontSize: '.72rem', color: 'var(--text-3)' }}>
          {backlogAndQueue.length} item{backlogAndQueue.length === 1 ? '' : 's'} waiting to start
          {backlogAndQueue.length > 0 && ` — oldest has been sitting ${oldestBacklogDays}d`}
        </div>
      </div>
    </div>
  )
}
