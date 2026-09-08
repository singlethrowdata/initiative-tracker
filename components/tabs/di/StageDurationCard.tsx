'use client'

import { DiInitiative } from '@/types'
import { stageDurationStats } from '@/lib/di-scheduling'

const STAGE_LABEL: Record<string, string> = {
  Design: 'Design',
  Build: 'Build',
  QA: 'QA',
  'Awaiting Approval': 'Approval',
  Deploy: 'Deploy',
  Blocked: 'Blocked',
  Paused: 'Paused',
}

interface Props {
  initiatives: DiInitiative[]
}

/** "Where time actually goes" — ranks every pipeline stage (plus Blocked/Paused,
 * the two friction states that stop work without advancing it) by average days
 * spent there, computed from every initiative's full di_status_history, not just
 * the currently active rows. Answers "what usually takes the longest" directly:
 * this was previously nowhere in the UI even though the data (entered_at/exited_at
 * per stage) had been captured since the initial sheet sync. */
export default function StageDurationCard({ initiatives }: Props) {
  const stats = stageDurationStats(initiatives)
  if (!stats.length) return null

  const maxAvg = Math.max(...stats.map(s => s.avgDays))

  return (
    <section className="next-opening" aria-labelledby="stage-duration-h">
      <div className="next-opening-label" id="stage-duration-h">Where time actually goes</div>
      <p className="duration-hint">
        Average days per stage, counting every stint (finished or still open) across all {initiatives.length} initiatives — ranked by the biggest bottleneck first.
      </p>
      {stats.map(s => (
        <div className="duration-row" key={s.status}>
          <span className="duration-label">{STAGE_LABEL[s.status] ?? s.status}</span>
          <div className="duration-track">
            <div className="duration-fill" style={{ width: `${maxAvg > 0 ? (s.avgDays / maxAvg) * 100 : 0}%` }} />
          </div>
          <span className="duration-value">
            {Math.round(s.avgDays)}d avg &middot; {Math.round(s.medianDays)}d median &middot; n={s.count}
          </span>
        </div>
      ))}
    </section>
  )
}
