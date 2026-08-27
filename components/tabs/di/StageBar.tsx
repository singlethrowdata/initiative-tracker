'use client'

import { DiInitiative } from '@/types'
import { buildStageSegments, bufferedStageWeeks, PIPELINE_STAGES } from '@/lib/di-scheduling'

// Maps a segment's real status onto the mockup's approved segment classes
// (docs/design/html/di-roadmap/index.html). Blocked/Paused/Awaiting Approval all
// render as the striped "waiting" segment because none of them draw the capacity
// budget (ADR-0001) — the striping is the visual cue for "not currently costing us
// build time".
const SEG_CLASS: Record<string, string> = {
  Design: 'seg-design',
  Build: 'seg-build',
  QA: 'seg-qa',
  Deploy: 'seg-deploy',
  'Awaiting Approval': 'seg-waiting',
  Blocked: 'seg-waiting',
  Paused: 'seg-waiting',
}

const STAGE_LABEL: Record<string, string> = {
  Design: 'Design',
  Build: 'Build',
  QA: 'QA',
  Deploy: 'Deploy',
  'Awaiting Approval': 'Approval',
  Blocked: 'Blocked',
  Paused: 'Paused',
}

interface Props {
  initiative: DiInitiative
}

/** Segmented stage bar — reuses buildStageSegments() from the scheduling engine so
 * the visual bar always agrees with the same math driving the variance number.
 * Bar width is scaled against the project's own total buffered pipeline estimate
 * (Design+Build+QA+Approval+Deploy), not a shared/global timeline, matching the
 * mockup's per-row proportional bar. */
export default function StageBar({ initiative }: Props) {
  const segments = buildStageSegments(initiative.history, initiative)
  const totalDays = PIPELINE_STAGES.reduce((sum, s) => sum + bufferedStageWeeks(initiative, s) * 7, 0) || 1

  let consumed = 0
  const bars: { key: string; className: string; widthPct: number }[] = []
  for (const seg of segments) {
    const days = seg.kind === 'todo' ? (seg.estDays ?? 0) : seg.days
    let pct = (days / totalDays) * 100
    if (consumed + pct > 100) pct = Math.max(0, 100 - consumed)
    if (pct <= 0) continue
    consumed += pct
    bars.push({
      key: `${seg.status}-${bars.length}`,
      className: SEG_CLASS[seg.status] ?? 'seg-remaining',
      widthPct: pct,
    })
  }
  if (consumed < 100) {
    bars.push({ key: 'remaining', className: 'seg-remaining', widthPct: 100 - consumed })
  }

  const labels = segments
    .filter(s => s.kind !== 'todo')
    .map(s => `${STAGE_LABEL[s.status] ?? s.status}${s.kind === 'now' || s.kind === 'hold' ? '\u00b7now' : ''}`)

  const currentSeg = segments.find(s => s.kind === 'now' || s.kind === 'hold')
  const ariaLabel = currentSeg
    ? `Currently in ${STAGE_LABEL[currentSeg.status] ?? currentSeg.status}`
    : segments.length
      ? 'Not yet started'
      : 'No stage history yet'

  return (
    <div>
      <div className="gantt-bar" role="img" aria-label={ariaLabel}>
        {bars.map(b => (
          <div key={b.key} className={`seg ${b.className}`} style={{ width: `${b.widthPct}%` }} />
        ))}
      </div>
      <div className="stage-labels">
        {labels.map((l, idx) => <span key={idx}>{l}</span>)}
      </div>
    </div>
  )
}
