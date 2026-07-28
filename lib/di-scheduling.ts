// Ports the D+I Roadmap's scheduling engine from the old Apps Script (Code.gs + Scheduler.gs)
// so target dates keep the exact same math, just computed on read instead of stamped in cells.

export const STATUS_VALUES = [
  'Backlog', 'In Queue', 'Design', 'Build', 'QA', 'Awaiting Approval', 'Deploy', 'Done', 'Blocked', 'Paused',
] as const
export type DiStatus = typeof STATUS_VALUES[number]

export const PRIORITY_VALUES = ['High', 'Medium', 'Low']
const PRIORITY_WEIGHT: Record<string, number> = { High: 0, Medium: 1, Low: 2 }

export interface SizePreset {
  design: number
  build: number
  qa: number
  approval: number
  deploy: number
}

export const SIZE_VALUES = ['Small', 'Medium', 'Large']

// Starting guesses, not calibrated from real data yet — tunable anytime via the
// `size_presets` key in di_config (JSON-encoded) without a redeploy. Candidate for
// monthly recalibration against actual Stage Duration once enough Done projects exist —
// see docs/adr/0003-estimate-buffer.md.
export const DEFAULT_SIZE_PRESETS: Record<string, SizePreset> = {
  Small: { design: 1, build: 1, qa: 1, approval: 1, deploy: 0.5 },
  Medium: { design: 2, build: 3, qa: 2, approval: 1, deploy: 1 },
  Large: { design: 3, build: 6, qa: 3, approval: 2, deploy: 1 },
}

export const TIER_VALUES = ['1 - Production', '2 - Build', '3 - Explore']
export const TYPE_VALUES = ['Tool', 'Pipeline', 'SOP', 'Automation', 'Research', 'Infrastructure', 'Other']
export const ARCHITECT_VALUES = ['Charles Blain', 'Darian Ward', 'TBD', 'Other']
export const OWNER_VALUES = ['Charles Blain', 'Darian Ward', 'Both', 'TBD', 'Other']

// Display/timeline set — everything past Backlog/In Queue that isn't Done. Typed as
// string[] (not DiStatus[]) since callers check against dynamic/incoming status strings.
export const ACTIVE_STATUSES: string[] = ['Design', 'Build', 'QA', 'Awaiting Approval', 'Deploy']

// The narrower set that actually counts against the WIP cap and Capacity's committed
// weeks. Awaiting Approval is Active but deliberately NOT In Flight — see
// docs/adr/0001-awaiting-approval-excluded-from-wip.md in the DI-roadmap repo.
export const IN_FLIGHT_STATUSES: string[] = ['Design', 'Build', 'QA', 'Deploy']

export const BLOCKER_CATEGORIES = ['internal_capacity', 'pm_scheduling', 'client_external', 'other'] as const
export type BlockerCategory = typeof BLOCKER_CATEGORIES[number]

export interface DiInitiativeRow {
  id: string
  queue_number: number | null // legacy/imported value — no longer authoritative, see recalcQueueDates
  priority: string | null
  owner: string | null
  status: string
  date_start: string | null
  created_at: string
  design_wks: number | string | null
  build_wks: number | string | null
  qa_wks: number | string | null
  approval_wks: number | string | null
  deploy_wks: number | string | null
  rice_r: number | string | null
  rice_i: number | string | null
  rice_c: number | string | null
}

export interface PhaseTargets {
  design_target: Date | null
  build_target: Date | null
  qa_target: Date | null
  approval_target: Date | null
  deploy_target: Date | null
  queue_number: number | null
}

const num = (v: number | string | null | undefined): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

// People (systematically) underestimate how long things take. Rather than trust the raw
// number typed into a phase-week field, everything that actually schedules or scores work
// uses this padded figure instead — the raw estimate you typed is still what's stored and
// shown back to you in the edit form, so re-saving never double-pads it. See
// docs/adr/0003-estimate-buffer.md.
export const ESTIMATE_BUFFER = 1.33

export const bufferedWeeks = (raw: number | string | null | undefined): number => num(raw) * ESTIMATE_BUFFER

const midnight = (d: Date) => {
  const c = new Date(d)
  c.setHours(0, 0, 0, 0)
  return c
}

const addWeeks = (date: Date, weeks: number): Date => {
  const d = new Date(date)
  d.setDate(d.getDate() + Math.round(weeks * 7))
  return d
}

/** RICE Score = R * I * (C/100) / E, guarded against divide-by-zero. E excludes
 * approval_wks deliberately — RICE's E is a stand-in for the team's own effort, and
 * Awaiting Approval doesn't consume the team's working hours (see ADR-0001). Uses the
 * padded (bufferedWeeks) figures, not the raw typed-in estimate — see ADR-0003. */
export function calcRiceE(row: DiInitiativeRow): number {
  return bufferedWeeks(row.design_wks) + bufferedWeeks(row.build_wks) + bufferedWeeks(row.qa_wks) + bufferedWeeks(row.deploy_wks)
}

export function calcRiceScore(row: DiInitiativeRow): number | null {
  const e = calcRiceE(row)
  if (!e) return null
  const r = num(row.rice_r)
  const i = num(row.rice_i)
  const c = num(row.rice_c)
  return (r * i * (c / 100)) / e
}

/** Direct port of _calcTargets() from Scheduler.gs, extended with an Awaiting Approval
 * leg between QA and Deploy. A row already past a phase gets that phase's target left
 * blank (matches the Sheet's "past phases are blank" behavior) but still chains
 * everything from the current phase forward. */
export function calcPhaseTargets(start: Date, status: string, row: DiInitiativeRow): PhaseTargets {
  const designWks = bufferedWeeks(row.design_wks)
  const buildWks = bufferedWeeks(row.build_wks)
  const qaWks = bufferedWeeks(row.qa_wks)
  const approvalWks = bufferedWeeks(row.approval_wks)
  const deployWks = bufferedWeeks(row.deploy_wks)

  const includeDesign = ['Design', 'In Queue', 'Paused', 'Blocked'].includes(status)
  const includeBuild = includeDesign || status === 'Build'
  const includeQA = includeBuild || status === 'QA'
  const includeApproval = includeQA || status === 'Awaiting Approval'

  let cursor = start
  let designTarget: Date | null = null
  let buildTarget: Date | null = null
  let qaTarget: Date | null = null
  let approvalTarget: Date | null = null

  if (includeDesign && designWks > 0) {
    cursor = addWeeks(cursor, designWks)
    designTarget = cursor
  }
  if (includeBuild && buildWks > 0) {
    cursor = addWeeks(cursor, buildWks)
    buildTarget = cursor
  }
  if (includeQA && qaWks > 0) {
    cursor = addWeeks(cursor, qaWks)
    qaTarget = cursor
  }
  if (includeApproval && approvalWks > 0) {
    cursor = addWeeks(cursor, approvalWks)
    approvalTarget = cursor
  }
  // Deploy is always computed, even if deployWks is 0 (adds 0 days).
  const deployTarget = addWeeks(cursor, deployWks)

  return {
    design_target: designTarget,
    build_target: buildTarget,
    qa_target: qaTarget,
    approval_target: approvalTarget,
    deploy_target: deployTarget,
    queue_number: null, // filled in by recalcQueueDates for rows that are actually ranked
  }
}

/** Queue # is no longer typed in by hand — it's computed per owner from Priority
 * (High/Medium/Low) first, then RICE Score as the tiebreaker within the same priority
 * (RICE Score is already the lexicon's signal for ranking unqueued work), then created_at
 * as a final deterministic tiebreak. A missing RICE Score sorts after any real score
 * within the same priority tier. See docs/adr/0002-priority-drives-queue-number.md. */
function compareForQueue(a: DiInitiativeRow, b: DiInitiativeRow): number {
  const pw = (PRIORITY_WEIGHT[a.priority ?? 'Medium'] ?? 1) - (PRIORITY_WEIGHT[b.priority ?? 'Medium'] ?? 1)
  if (pw !== 0) return pw

  const ra = calcRiceScore(a)
  const rb = calcRiceScore(b)
  if (ra !== rb) {
    if (ra == null) return 1
    if (rb == null) return -1
    return rb - ra // descending — higher RICE first
  }

  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
}

/** Direct port of recalculateDates() from Scheduler.gs: chains queued+active rows per
 * owner, each starting the day after the previous one's projected Deploy end — except the
 * per-owner order now comes from compareForQueue() (Priority + RICE) instead of a
 * manually-typed Queue #. Rows not in the active pipeline (Backlog/Done) get no ranking;
 * everything else still in the pipeline but not part of an owner's ranked chain (e.g.
 * Paused/Blocked) gets a hypothetical "if it started today" projection instead. Returns a
 * Map keyed by row id. */
export function recalcQueueDates(rows: DiInitiativeRow[], today: Date = new Date()): Map<string, PhaseTargets> {
  const t = midnight(today)
  const out = new Map<string, PhaseTargets>()

  const isQueueable = (r: DiInitiativeRow) =>
    ACTIVE_STATUSES.includes(r.status) || r.status === 'In Queue'

  const byOwner = new Map<string, DiInitiativeRow[]>()
  for (const r of rows) {
    if (!isQueueable(r)) continue
    const owner = r.owner || 'Unassigned'
    if (!byOwner.has(owner)) byOwner.set(owner, [])
    byOwner.get(owner)!.push(r)
  }

  for (const [, ownerRows] of byOwner) {
    ownerRows.sort(compareForQueue)
    let cursor = t
    ownerRows.forEach((r, index) => {
      const start = r.status !== 'Design' && r.date_start ? new Date(r.date_start) : cursor
      const targets = calcPhaseTargets(start, r.status, r)
      targets.queue_number = index + 1
      out.set(r.id, targets)
      cursor = new Date((targets.deploy_target as Date).getTime() + 24 * 60 * 60 * 1000)
    })
  }

  for (const r of rows) {
    if (out.has(r.id)) continue
    if (r.status === 'Backlog' || r.status === 'Done') continue
    out.set(r.id, calcPhaseTargets(t, r.status, r))
  }

  return out
}

/** Same single condition as checkOverdueMilestones() in the old Scheduler.gs: only the
 * Deploy Target is ever compared to today. */
export function isOverdue(status: string, deployTarget: Date | null, today: Date = new Date()): boolean {
  if (!deployTarget) return false
  if (['Done', 'Paused', 'Backlog'].includes(status)) return false
  return deployTarget < midnight(today)
}

interface HistoryEntry {
  status: string
  entered_at: string
  exited_at: string | null
  blocker_category?: string | null
  blocker_note?: string | null
}

// The 6 stages shown on the Stage Band and as Board columns — the "active pipeline."
// Backlog/Done/Blocked/Paused are reachable via List view or segment filters, not board
// columns (they'd otherwise clutter the board with rarely-moved buckets).
export const ACTIVE_PIPELINE_STATUSES = ['In Queue', 'Design', 'Build', 'QA', 'Awaiting Approval', 'Deploy']

interface StageRowLike {
  design_wks: number | string | null
  build_wks: number | string | null
  qa_wks: number | string | null
  approval_wks: number | string | null
  deploy_wks: number | string | null
}

/** Padded estimate, in DAYS, for one stage — null for stages with no stored estimate
 * (Backlog/In Queue aren't sized). Design/Build/QA/Awaiting Approval/Deploy map directly
 * onto the five stored phase-week fields. */
export function stageEstimateDays(row: StageRowLike, status: string): number | null {
  switch (status) {
    case 'Design': return bufferedWeeks(row.design_wks) * 7
    case 'Build': return bufferedWeeks(row.build_wks) * 7
    case 'QA': return bufferedWeeks(row.qa_wks) * 7
    case 'Awaiting Approval': return bufferedWeeks(row.approval_wks) * 7
    case 'Deploy': return bufferedWeeks(row.deploy_wks) * 7
    default: return null
  }
}

export interface StageSegment {
  status: string
  days: number
  kind: 'done' | 'now' | 'over' | 'todo' | 'hold'
  estDays: number | null
  overDays: number
}

/** Builds the ordered segment list for the labeled stage bar: every stage the initiative
 * has actually passed through or is currently in (kind: done/now/over, or hold if the
 * open stage has a Blocker Reason tagged — see lexicon.md), plus remaining active-pipeline
 * stages ahead as a hollow "todo" preview sized by their estimate. */
export function buildStageSegments(history: HistoryEntry[], row: StageRowLike): StageSegment[] {
  const segments: StageSegment[] = []
  const seen = new Set<string>()

  for (const h of history) {
    const days = ((h.exited_at ? new Date(h.exited_at).getTime() : Date.now()) - new Date(h.entered_at).getTime()) / 86_400_000
    const est = stageEstimateDays(row, h.status)
    const over = est != null && days > est ? days - est : 0
    const isOpen = !h.exited_at
    const held = isOpen && !!h.blocker_category
    const kind: StageSegment['kind'] = held ? 'hold' : over > 0 ? 'over' : isOpen ? 'now' : 'done'
    segments.push({ status: h.status, days, kind, estDays: est, overDays: over })
    seen.add(h.status)
  }

  const currentIndex = ACTIVE_PIPELINE_STATUSES.indexOf(segments[segments.length - 1]?.status ?? '')
  if (currentIndex >= 0) {
    for (let i = currentIndex + 1; i < ACTIVE_PIPELINE_STATUSES.length; i++) {
      const status = ACTIVE_PIPELINE_STATUSES[i]
      if (seen.has(status)) continue
      const est = stageEstimateDays(row, status)
      segments.push({ status, days: est ?? 0, kind: 'todo', estDays: est, overDays: 0 })
    }
  }

  return segments
}

/** Total days elapsed across every stage the initiative has ever been in. */
export function elapsedDays(history: HistoryEntry[]): number {
  return history.reduce((sum, h) => {
    const end = h.exited_at ? new Date(h.exited_at).getTime() : Date.now()
    return sum + (end - new Date(h.entered_at).getTime()) / 86_400_000
  }, 0)
}

/** Sum of every stage's padded estimate — the "how big is this, total" number. */
export function estimatedTotalDays(row: StageRowLike): number {
  return ACTIVE_PIPELINE_STATUSES.reduce((sum, s) => sum + (stageEstimateDays(row, s) ?? 0), 0)
}

/** The countdown metric: for the CURRENTLY open stage, how many days remain until it's
 * expected to move on (positive `remaining`), or how many days past that estimate it
 * already is (positive `over`). Null if the current stage has no stored estimate
 * (Backlog/In Queue). */
export function stageCountdown(history: HistoryEntry[], row: StageRowLike): { remaining: number; over: number } | null {
  const open = history.find(h => !h.exited_at)
  if (!open) return null
  const est = stageEstimateDays(row, open.status)
  if (est == null) return null
  const actual = currentStageDays(history) ?? 0
  const diff = est - actual
  return diff >= 0 ? { remaining: Math.round(diff), over: 0 } : { remaining: 0, over: Math.round(-diff) }
}

/** Days spent in whichever stage is currently open (exited_at IS NULL). Null if the
 * initiative has no history at all (shouldn't happen, but defensive). */
export function currentStageDays(history: HistoryEntry[]): number | null {
  const open = history.find(h => !h.exited_at)
  if (!open) return null
  return (Date.now() - new Date(open.entered_at).getTime()) / 86_400_000
}

/** Averages every Awaiting Approval stint (closed or currently open) across all given
 * initiatives — the headline "how long is EVPO turnaround really taking" number. */
export function avgApprovalDays(initiatives: { history: HistoryEntry[] }[]): number | null {
  const durations: number[] = []
  for (const init of initiatives) {
    for (const h of init.history) {
      if (h.status !== 'Awaiting Approval') continue
      const end = h.exited_at ? new Date(h.exited_at).getTime() : Date.now()
      durations.push((end - new Date(h.entered_at).getTime()) / 86_400_000)
    }
  }
  if (!durations.length) return null
  return durations.reduce((a, b) => a + b, 0) / durations.length
}
