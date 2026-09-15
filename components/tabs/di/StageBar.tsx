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
  const estimateDays = PIPELINE_STAGES.reduce((sum, s) => sum + bufferedStageWeeks(initiative, s) * 7, 0)
  const actualDays = segments.filter(s => s.kind !== 'todo').reduce((sum, s) => sum + s.days, 0)
  // Width scales to whichever is larger: the project's total estimate, or the real
  // days already spent. Without the actualDays floor, a badly overrun early stage
  // (e.g. Design running 2x its estimate) would consume the whole bar and clip the
  // current stage's segment to zero width — hiding exactly what "over" is meant to
  // surface. Only the hollow 'todo' preview shrinks once you're already over budget.
  const totalDays = Math.max(estimateDays, actualDays) || 1

  const labelFor = (s: (typeof segments)[number]) => ({
    text: `${s.isEstimated ? '~' : ''}${STAGE_LABEL[s.status] ?? s.status} \u00b7 ${Math.round(s.days)}d${s.kind === 'now' || s.kind === 'hold' ? ' \u00b7now' : ''}${s.overDays > 0 ? ` \u00b7 ${Math.round(s.overDays)}d over` : ''}`,
    title: (s.estDays != null
      ? `${STAGE_LABEL[s.status] ?? s.status}: ${Math.round(s.days)} of ${Math.round(s.estDays)} estimated days`
      : `${STAGE_LABEL[s.status] ?? s.status}: ${Math.round(s.days)} days`) + (s.isEstimated ? ' (estimated \u2014 no tracked data before the Jul 28 migration)' : ''),
  })

  let consumed = 0
  const bars: { key: string; className: string; widthPct: number; text: string | null; title: string | null }[] = []
  for (const seg of segments) {
    const days = seg.kind === 'todo' ? (seg.estDays ?? 0) : seg.days
    let pct = (days / totalDays) * 100
    if (consumed + pct > 100) pct = Math.max(0, 100 - consumed)
    if (pct <= 0) continue
    consumed += pct
    const label = seg.kind === 'todo' ? null : labelFor(seg)
    bars.push({
      key: `${seg.status}-${bars.length}`,
      className: SEG_CLASS[seg.status] ?? 'seg-remaining',
      widthPct: pct,
      text: label?.text ?? null,
      title: label?.title ?? null,
    })
  }
  if (consumed < 100) {
    bars.push({ key: 'remaining', className: 'seg-remaining', widthPct: 100 - consumed, text: null, title: null })
  }

  const currentSeg = segments.find(s => s.kind === 'now' || s.kind === 'hold')
  const ariaLabel = currentSeg
    ? `Currently in ${STAGE_LABEL[currentSeg.status] ?? currentSeg.status}, ${Math.round(currentSeg.days)} days`
    : segments.length
      ? 'Not yet started'
      : 'No stage history yet'

  return (
    <div className="gantt-bar" role="img" aria-label={ariaLabel}>
      {bars.map(b => (
        <div key={b.key} className={`seg ${b.className}`} style={{ width: `${b.widthPct}%` }} title={b.title ?? undefined}>
          {b.text && <span className="seg-label">{b.text}</span>}
        </div>
      ))}
    </div>
  )
}
