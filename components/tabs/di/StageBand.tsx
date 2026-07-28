'use client'

import { DiInitiative } from '@/types'
import { ACTIVE_PIPELINE_STATUSES, currentStageDays } from '@/lib/di-scheduling'

interface Props {
  initiatives: DiInitiative[]
}

const SHORT: Record<string, string> = {
  'In Queue': 'Queue', Design: 'Design', Build: 'Build', QA: 'QA', 'Awaiting Approval': 'Approval', Deploy: 'Deploy',
}

function median(nums: number[]): number {
  if (!nums.length) return 0
  const sorted = [...nums].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

// Per-stage median actual-days + count currently there — replaces the old generic KPI
// strip with something that answers "where is the pileup" at a glance, one cell per
// active-pipeline stage.
export default function StageBand({ initiatives }: Props) {
  return (
    <div className="di-band">
      {ACTIVE_PIPELINE_STATUSES.map(status => {
        const here = initiatives.filter(i => i.status === status)
        const days = here.map(i => Math.round(currentStageDays(i.history) ?? 0))
        return (
          <div key={status} className="di-band-cell">
            <p className="di-band-label">{SHORT[status]}</p>
            <p className="di-band-value">{median(days)}d</p>
            <p className="di-band-note">{here.length} here now</p>
          </div>
        )
      })}
    </div>
  )
}
