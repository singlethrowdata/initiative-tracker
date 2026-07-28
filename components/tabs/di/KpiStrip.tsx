'use client'

import { DiInitiative } from '@/types'
import { IN_FLIGHT_STATUSES, currentStageDays, avgApprovalDays } from '@/lib/di-scheduling'

interface Props {
  initiatives: DiInitiative[]
  stageWarnDays: number
}

// The "5-second glance" summary — visible above every view (List/Capacity/Flow), not
// buried in one of them. See lexicon.md "Capacity" for why this is separate from the
// existing Weekly Summary process.
export default function KpiStrip({ initiatives, stageWarnDays }: Props) {
  const inFlight = initiatives.filter(i => IN_FLIGHT_STATUSES.includes(i.status)).length
  const overdue = initiatives.filter(i => i.overdue).length
  const agingBacklog = initiatives.filter(i => {
    if (i.status !== 'Backlog' && i.status !== 'In Queue') return false
    const days = currentStageDays(i.history)
    return days != null && days >= stageWarnDays
  }).length
  const avgApproval = avgApprovalDays(initiatives)

  const cards = [
    { label: 'In Flight', value: inFlight },
    { label: 'Overdue', value: overdue },
    { label: 'Aging Backlog/Queue', value: agingBacklog },
    { label: 'Avg EVPO Approval', value: avgApproval != null ? `${avgApproval.toFixed(1)}d` : '—' },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '.6rem', marginBottom: '1rem' }}>
      {cards.map(c => (
        <div key={c.label} className="di-cap-card" style={{ padding: '.75rem 1rem' }}>
          <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>{c.value}</div>
          <div style={{ fontSize: '.65rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{c.label}</div>
        </div>
      ))}
    </div>
  )
}
