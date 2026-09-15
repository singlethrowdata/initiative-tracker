// D+I Roadmap scheduling engine. Stage/row-local math (size presets, the 1.33x
// under-estimation buffer, RICE, stage-segment/countdown helpers) is ported unchanged
// from the pre-teardown build (commit 7136787^) per ADR-0001 — that feedback never
// flagged those as wrong. The cross-project scheduling model has moved twice since:
// ADR-0001/0003's one shared weekly budget, then ADR-0006/0007's per-owner concurrent
// WIP-slot simulation (current) — see computeCapacityView's doc comment.

export const STATUS_VALUES = [
  'Backlog', 'In Queue', 'Design', 'Build', 'QA', 'Awaiting Approval', 'Deploy', 'Done', 'Blocked', 'Paused',
] as const
export type DiStatus = typeof STATUS_VALUES[number]

export const PRIORITY_VALUES = ['High', 'Medium', 'Low']

export interface SizePreset {
  design: number
  build: number
  qa: number
  approval: number
  deploy: number
}

export const SIZE_VALUES = ['Small', 'Medium', 'Large', 'Custom']

// Starting guesses, not calibrated from real data yet — tunable anytime via the
// `size_presets` key in di_config (JSON-encoded) without a redeploy.
export const DEFAULT_SIZE_PRESETS: Record<string, SizePreset> = {
  Small: { design: 1, build: 1, qa: 1, approval: 1, deploy: 0.5 },
  Medium: { design: 2, build: 3, qa: 2, approval: 1, deploy: 1 },
  Large: { design: 3, build: 6, qa: 3, approval: 2, deploy: 1 },
}

export const TIER_VALUES = ['1 - Production', '2 - Build', '3 - Explore']
export const TYPE_VALUES = ['Tool', 'Pipeline', 'SOP', 'Automation', 'Research', 'Infrastructure', 'Other']
export const ARCHITECT_VALUES = ['Charles Blain', 'Darian Ward', 'TBD', 'Other']
export const OWNER_VALUES = ['Charles Blain', 'Darian Ward', 'Both', 'TBD', 'Other']

export const BLOCKER_CATEGORIES = ['internal_capacity', 'pm_scheduling', 'client_external', 'other'] as const
export type BlockerCategory = typeof BLOCKER_CATEGORIES[number]

// ADR-0002/ADR-0005: the people whose sign-in grants create/edit control.
// cblain@/dward@ are the two D+I builders; submissions@ is the shared STM
// admin identity, granted permanently (ADR-0005), not per-testing-session.
// Seeded into di_config.team_emails so it's editable without a redeploy.
export const DEFAULT_TEAM_EMAILS = ['cblain@singlethrow.com', 'dward@singlethrow.com', 'submissions@singlethrow.com']

// The fixed 5-leg build pipeline, in order. 'Awaiting Approval' sits between QA and
// Deploy but — per ADR-0006 — doesn't draw down a WIP slot.
export const PIPELINE_STAGES = ['Design', 'Build', 'QA', 'Awaiting Approval', 'Deploy']

// Display/timeline set — everything past Backlog/In Queue that isn't Done.
export const ACTIVE_STATUSES: string[] = [...PIPELINE_STAGES]

// "Actively in the pipeline" for display purposes only (GanttRow's "architect: …"
// in-flight label) — NOT used for any capacity or effort math. See WIP_CAP_STATUSES
// below for the set that actually drives capacity/effort accounting (ADR-0006/0007).
export const IN_FLIGHT_STATUSES: string[] = ['Design', 'Build', 'QA', 'Deploy']

// The narrower-still set that occupies one of a person's concurrent work slots
// (ADR-0004, corrected by ADR-0006: "each owner can only work on N projects at a
// time" — a per-person limit, not a shared team-wide one. Grouped by Owner, per
// lexicon.md's "Owner is currently building it" — not Architect, who designed/
// spec'd the project but isn't necessarily who's occupying the build slot).
// QA, Awaiting Approval, Blocked, and Paused are still real calendar time for the
// project (they still show on the Gantt and still count for target-date math
// above) but don't tie up a person's active build bandwidth, so they don't draw
// down the WIP cap. This same set is also what the per-owner queue-ETA simulation
// (ADR-0007) treats as "occupying a slot" — QA/Approval never gate when the next
// queued item can start.
export const WIP_CAP_STATUSES: string[] = ['Design', 'Build', 'Deploy']

// Default per-owner WIP cap — config-driven via di_config.wip_cap_per_owner, not
// hardcoded (ADR-0006).
export const DEFAULT_WIP_CAP_PER_OWNER = 5

export const QUEUED_STATUSES: string[] = ['Backlog', 'In Queue']

// The 6 stages shown as Board columns once work is actually queued.
export const ACTIVE_PIPELINE_STATUSES = ['In Queue', 'Design', 'Build', 'QA', 'Awaiting Approval', 'Deploy']
export const BOARD_STATUSES: string[] = ['Backlog', ...ACTIVE_PIPELINE_STATUSES]

export interface DiInitiativeRow {
  id: string
  status: string
  owner: string
  priority: string
  date_start: string | null
  queue_position: number | null
  rice_r: number | string | null
  rice_i: number | string | null
  rice_c: number | string | null
  design_wks: number | string | null
  build_wks: number | string | null
  qa_wks: number | string | null
  approval_wks: number | string | null
  deploy_wks: number | string | null
  created_at: string
}

export interface HistoryEntry {
  status: string
  entered_at: string
  exited_at: string | null
  blocker_category?: string | null
  blocker_note?: string | null
  is_estimated?: boolean
}

const num = (v: number | string | null | undefined): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const round1 = (n: number) => Math.round(n * 10) / 10

// People (systematically) underestimate how long things take. Everything that
// actually schedules or scores work uses this padded figure instead of the raw
// typed-in estimate — the raw number is still what's stored and shown back in the
// edit form, so re-saving never double-pads it.
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

function rawStageWeeks(row: DiInitiativeRow, stage: string): number {
  switch (stage) {
    case 'Design': return num(row.design_wks)
    case 'Build': return num(row.build_wks)
    case 'QA': return num(row.qa_wks)
    case 'Awaiting Approval': return num(row.approval_wks)
    case 'Deploy': return num(row.deploy_wks)
    default: return 0
  }
}

export const bufferedStageWeeks = (row: DiInitiativeRow, stage: string): number => rawStageWeeks(row, stage) * ESTIMATE_BUFFER

/** Buffered Design+Build+Deploy only — the weeks that actually occupy a WIP slot
 * (ADR-0006/0007). Excludes QA and Awaiting Approval: neither draws build bandwidth,
 * so neither gates capacity, effort scoring, or queue-ETA math — they still count as
 * real calendar time in calcPhaseTargets/the Gantt bar, just not here. */
export const fullInFlightWeeks = (row: DiInitiativeRow): number =>
  bufferedStageWeeks(row, 'Design') + bufferedStageWeeks(row, 'Build') + bufferedStageWeeks(row, 'Deploy')

/** RICE Score = R * I * (C/100) / E, guarded against divide-by-zero. E excludes
 * QA and approval_wks deliberately — neither consumes the team's working hours
 * (ADR-0006/0007). Uses the padded (bufferedWeeks) figures, not the raw estimate. */
export function calcRiceScore(row: DiInitiativeRow): number | null {
  const e = fullInFlightWeeks(row)
  if (!e) return null
  const r = num(row.rice_r)
  const i = num(row.rice_i)
  const c = num(row.rice_c)
  return (r * i * (c / 100)) / e
}

/** Which real pipeline stage this row's remaining work should be measured against.
 * Design/Build/QA/Awaiting Approval/Deploy map to themselves. Blocked/Paused resolve
 * to whichever stage was open right before the row left the pipeline — found by
 * walking history backward for the most recent closed work-stage entry. Backlog/In
 * Queue/Done have no effective stage (null: not started, or already finished). */
export function effectiveStage(row: { status: string }, history: HistoryEntry[]): string | null {
  if (PIPELINE_STAGES.includes(row.status)) return row.status
  if (row.status === 'Blocked' || row.status === 'Paused') {
    for (let i = history.length - 1; i >= 0; i--) {
      const h = history[i]
      if (h.exited_at && PIPELINE_STAGES.includes(h.status)) return h.status
    }
    return null
  }
  return null
}

/** Elapsed weeks across every history entry matching `stage` (open or closed) — summed,
 * not just the latest, so a stage worked, then Blocked, then resumed still gets credit
 * for the time already spent before the block. */
function stageEntryElapsedWeeks(history: HistoryEntry[], stage: string): number {
  let totalMs = 0
  for (const h of history) {
    if (h.status !== stage) continue
    const end = h.exited_at ? new Date(h.exited_at).getTime() : Date.now()
    totalMs += end - new Date(h.entered_at).getTime()
  }
  return totalMs / (7 * 86_400_000)
}

/** Buffered WIP-only weeks (Design/Build/Deploy) still ahead of this row before its
 * current owner-slot frees — the per-owner queue simulation's building block
 * (ADR-0007). 0 for anything not currently occupying a WIP_CAP_STATUSES stage; a
 * not-yet-started queued row's own full duration is `fullInFlightWeeks`, not this. */
function remainingWipWeeks(row: DiInitiativeRow, history: HistoryEntry[]): number {
  const stage = effectiveStage(row, history)
  if (stage == null || !WIP_CAP_STATUSES.includes(stage)) return 0
  const idx = WIP_CAP_STATUSES.indexOf(stage)
  const elapsed = stageEntryElapsedWeeks(history, stage)
  const remainingHere = Math.max(0, bufferedStageWeeks(row, stage) - elapsed)
  const laterWeeks = WIP_CAP_STATUSES.slice(idx + 1).reduce((sum, s) => sum + bufferedStageWeeks(row, s), 0)
  return remainingHere + laterWeeks
}

export interface PhaseTargets {
  design_target: Date | null
  build_target: Date | null
  qa_target: Date | null
  approval_target: Date | null
  deploy_target: Date | null
}

/** Target finish date for each pipeline stage from `stage` (the current effective
 * stage; null means not started yet) onward, chained from `start`. Stages already
 * passed (before `stage`) get a blank target, matching "past phases are blank". */
export function calcPhaseTargets(start: Date, stage: string | null, row: DiInitiativeRow): PhaseTargets {
  const idx = stage ? PIPELINE_STAGES.indexOf(stage) : 0
  const targets: Record<string, Date | null> = {}
  let cursor = start
  PIPELINE_STAGES.forEach((s, i) => {
    const wks = bufferedStageWeeks(row, s)
    cursor = addWeeks(cursor, wks)
    targets[s] = i >= idx ? cursor : null
  })
  return {
    design_target: targets['Design'],
    build_target: targets['Build'],
    qa_target: targets['QA'],
    approval_target: targets['Awaiting Approval'],
    deploy_target: targets['Deploy'],
  }
}

/** Target date for whichever stage is currently effective — what the Gantt bar and
 * variance number are measured against. */
function currentStageTarget(targets: PhaseTargets, stage: string | null): Date | null {
  switch (stage) {
    case 'Design': return targets.design_target
    case 'Build': return targets.build_target
    case 'QA': return targets.qa_target
    case 'Awaiting Approval': return targets.approval_target
    case 'Deploy': return targets.deploy_target
    default: return targets.deploy_target
  }
}

export interface CapacityView {
  wipCapPerOwner: number
  drawByOwner: { owner: string; count: number }[]
  perItem: Map<string, {
    in_flight: boolean
    target_date: string | null
    variance_weeks: number | null
    finishes_in_weeks: number | null
  }>
  nextOpening: (preset: SizePreset) => { finishesInWeeks: number }
}

const PRIORITY_RANK: Record<string, number> = Object.fromEntries(PRIORITY_VALUES.map((p, i) => [p, i]))

export interface OwnerSlotSim {
  peek: () => number
  claim: (duration: number) => number
}

/** Simulates one owner's WIP slots as a small multi-server queue: `wipCap` slots,
 * each already-busy one booked until its `inFlightRemainingWeeks` entry, the rest
 * free at t=0. `claim(duration)` hands the soonest-opening slot to the next queued
 * item, books it busy until `start + duration`, and returns the claimed start —
 * so a backlog longer than the current in-flight count still resolves correctly by
 * cascading through each subsequent hand-off (ADR-0007). `peek` reads the soonest
 * opening without claiming it, for `nextOpening`'s "whoever's free first" check. */
function buildOwnerSlotSim(inFlightRemainingWeeks: number[], wipCap: number): OwnerSlotSim {
  const freeNow = Math.max(0, wipCap - inFlightRemainingWeeks.length)
  const openings = [...Array(freeNow).fill(0), ...inFlightRemainingWeeks].sort((a, b) => a - b)
  return {
    peek: (): number => openings[0] ?? 0,
    claim: (duration: number): number => {
      const start = openings.shift() ?? 0
      const nextOpening = start + duration
      let i = 0
      while (i < openings.length && openings[i] < nextOpening) i++
      openings.splice(i, 0, nextOpening)
      return start
    },
  }
}

/** ADR-0006/0007: capacity is per-owner concurrent WIP slots (`wipCapPerOwner` each),
 * not one shared serial budget — the team works multiple projects at once across
 * both owners, and QA/Awaiting Approval never occupy a slot (`WIP_CAP_STATUSES`).
 * `drawByOwner` is the live "N / cap" count per owner. `finishes_in_weeks` (queued
 * rows) and `nextOpening` (a hypothetical new project) both come from simulating
 * each owner's slot timeline forward: in-flight work frees slots as it finishes its
 * remaining Design/Build/Deploy time; queued items claim openings in priority order
 * (then `queue_position`) — a High-priority item jumps ahead of a same-owner
 * Medium/Low item regardless of drag order, which is the concrete meaning of
 * "priority can escalate" here; and each claim books a slot, cascading the
 * simulation through backlogs longer than the current in-flight count. */
export function computeCapacityView(
  rows: DiInitiativeRow[],
  historyByRow: Map<string, HistoryEntry[]>,
  wipCapPerOwner: number,
  today: Date = new Date(),
): CapacityView {
  const t = midnight(today)
  const perItem: CapacityView['perItem'] = new Map()

  const drawCounts = new Map<string, number>()
  for (const r of rows) {
    if (!WIP_CAP_STATUSES.includes(r.status)) continue
    const owner = r.owner?.trim() || 'Unassigned'
    drawCounts.set(owner, (drawCounts.get(owner) ?? 0) + 1)
  }
  const drawByOwner = [...drawCounts.entries()]
    .map(([owner, count]) => ({ owner, count }))
    .sort((a, b) => b.count - a.count || a.owner.localeCompare(b.owner))

  const startedStatuses = [...PIPELINE_STAGES, 'Blocked', 'Paused']
  const startedRows = rows.filter(r => startedStatuses.includes(r.status))

  for (const r of startedRows) {
    const history = historyByRow.get(r.id) ?? []
    const stage = effectiveStage(r, history)
    // No date_start means the row hasn't actually begun (common for Paused/Blocked
    // items created straight into those statuses) — there's nothing to measure a
    // schedule variance against, so leave it null rather than falling back to
    // "today" (which previously produced a nonsensical "ahead of schedule" number).
    const targetDate = r.date_start
      ? currentStageTarget(calcPhaseTargets(new Date(r.date_start), stage, r), stage)
      : null
    const varianceWeeks = targetDate ? round1((t.getTime() - targetDate.getTime()) / (7 * 86_400_000)) : null
    perItem.set(r.id, {
      in_flight: WIP_CAP_STATUSES.includes(r.status),
      target_date: targetDate ? targetDate.toISOString() : null,
      variance_weeks: varianceWeeks,
      finishes_in_weeks: null,
    })
  }

  const queuedRows = rows
    .filter(r => QUEUED_STATUSES.includes(r.status))
    .slice()
    .sort((a, b) => (a.queue_position ?? Infinity) - (b.queue_position ?? Infinity))

  const owners = new Set<string>()
  for (const r of rows) {
    if (WIP_CAP_STATUSES.includes(r.status) || QUEUED_STATUSES.includes(r.status)) {
      owners.add(r.owner?.trim() || 'Unassigned')
    }
  }
  const sims = new Map<string, OwnerSlotSim>()
  for (const owner of owners) {
    const inFlight = rows.filter(r => WIP_CAP_STATUSES.includes(r.status) && (r.owner?.trim() || 'Unassigned') === owner)
    const remaining = inFlight.map(r => remainingWipWeeks(r, historyByRow.get(r.id) ?? []))
    sims.set(owner, buildOwnerSlotSim(remaining, wipCapPerOwner))
  }

  const byOwnerQueue = new Map<string, DiInitiativeRow[]>()
  for (const r of queuedRows) {
    const owner = r.owner?.trim() || 'Unassigned'
    const list = byOwnerQueue.get(owner) ?? []
    list.push(r)
    byOwnerQueue.set(owner, list)
  }
  for (const [owner, list] of byOwnerQueue) {
    list.sort((a, b) =>
      (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1)
      || (a.queue_position ?? Infinity) - (b.queue_position ?? Infinity))
    const sim = sims.get(owner) ?? buildOwnerSlotSim([], wipCapPerOwner)
    for (const r of list) {
      const wipWeeks = fullInFlightWeeks(r)
      const startsInWeeks = sim.claim(wipWeeks)
      const calendarWeeks = wipWeeks + bufferedStageWeeks(r, 'QA') + bufferedStageWeeks(r, 'Awaiting Approval')
      perItem.set(r.id, {
        in_flight: false,
        target_date: null,
        variance_weeks: null,
        finishes_in_weeks: round1(startsInWeeks + calendarWeeks),
      })
    }
  }

  return {
    wipCapPerOwner,
    drawByOwner,
    perItem,
    nextOpening: (preset: SizePreset) => {
      const startsInWeeks = sims.size > 0 ? Math.min(...[...sims.values()].map(s => s.peek())) : 0
      const wipWeeks = (preset.design + preset.build + preset.deploy) * ESTIMATE_BUFFER
      const calendarWeeks = wipWeeks + (preset.qa + preset.approval) * ESTIMATE_BUFFER
      return { finishesInWeeks: round1(startsInWeeks + calendarWeeks) }
    },
  }
}

/** Where a newly-created queued item should be inserted by default: after every
 * existing queued item (sorted by queue_position asc) with a strictly higher RICE
 * score. A missing RICE score sorts to the back. Returns a 0-based insertion index;
 * the caller shifts queue_position >= this index up by one and inserts at it. */
export function insertionIndexByRice(existingOrdered: DiInitiativeRow[], newRiceScore: number | null): number {
  for (let i = 0; i < existingOrdered.length; i++) {
    const existingScore = calcRiceScore(existingOrdered[i])
    if (newRiceScore == null) continue
    if (existingScore == null || newRiceScore > existingScore) return i
  }
  return existingOrdered.length
}

/** Padded estimate, in DAYS, for one stage — 0 for stages with no stored estimate. */
export function stageEstimateDays(row: DiInitiativeRow, status: string): number | null {
  if (!PIPELINE_STAGES.includes(status)) return null
  return bufferedStageWeeks(row, status) * 7
}

/** One history entry's elapsed days — from entered_at to exited_at, or to now if
 * still open. The single "how long was this stint" calc every duration metric
 * below is built from. */
export function stintDays(h: HistoryEntry): number {
  const end = h.exited_at ? new Date(h.exited_at).getTime() : Date.now()
  return (end - new Date(h.entered_at).getTime()) / 86_400_000
}

export interface StageSegment {
  status: string
  days: number
  kind: 'done' | 'now' | 'over' | 'todo' | 'hold'
  estDays: number | null
  overDays: number
  isEstimated: boolean
}

/** Builds the ordered segment list for the labeled stage bar: every stage the
 * initiative has actually passed through or is currently in (kind: done/now/over, or
 * hold if the open stage has a Blocker Category tagged), plus remaining
 * active-pipeline stages ahead as a hollow "todo" preview sized by their estimate. */
export function buildStageSegments(history: HistoryEntry[], row: DiInitiativeRow): StageSegment[] {
  const segments: StageSegment[] = []
  const seen = new Set<string>()

  for (const h of history) {
    const days = stintDays(h)
    const est = stageEstimateDays(row, h.status)
    const over = est != null && days > est ? days - est : 0
    const isOpen = !h.exited_at
    const held = isOpen && !!h.blocker_category
    const kind: StageSegment['kind'] = held ? 'hold' : over > 0 ? 'over' : isOpen ? 'now' : 'done'
    segments.push({ status: h.status, days, kind, estDays: est, overDays: over, isEstimated: !!h.is_estimated })
    seen.add(h.status)
  }

  const currentIndex = ACTIVE_PIPELINE_STATUSES.indexOf(segments[segments.length - 1]?.status ?? '')
  if (currentIndex >= 0) {
    for (let i = currentIndex + 1; i < ACTIVE_PIPELINE_STATUSES.length; i++) {
      const status = ACTIVE_PIPELINE_STATUSES[i]
      if (seen.has(status)) continue
      const est = stageEstimateDays(row, status)
      segments.push({ status, days: est ?? 0, kind: 'todo', estDays: est, overDays: 0, isEstimated: false })
    }
  }

  return segments
}

/** Total days elapsed across every stage the initiative has ever been in. */
export function elapsedDays(history: HistoryEntry[]): number {
  return history.reduce((sum, h) => sum + stintDays(h), 0)
}

/** The countdown metric: for the CURRENTLY open stage, how many days remain until
 * it's expected to move on (positive `remaining`), or how many days past that
 * estimate it already is (positive `over`). Null if there's no open stage or no
 * stored estimate for it. */
export function stageCountdown(history: HistoryEntry[], row: DiInitiativeRow): { remaining: number; over: number } | null {
  const open = history.find(h => !h.exited_at)
  if (!open) return null
  const est = stageEstimateDays(row, open.status)
  if (est == null) return null
  const actual = currentStageDays(history) ?? 0
  const diff = est - actual
  return diff >= 0 ? { remaining: Math.round(diff), over: 0 } : { remaining: 0, over: Math.round(-diff) }
}

/** Days spent in whichever stage is currently open (exited_at IS NULL). Null if the
 * initiative has no open stage. */
export function currentStageDays(history: HistoryEntry[]): number | null {
  const open = history.find(h => !h.exited_at)
  return open ? stintDays(open) : null
}

/** Same condition the old Scheduler.gs used: only the Deploy Target is ever compared
 * to today, and only for rows still actively moving through the pipeline. */
export function isOverdue(status: string, deployTarget: Date | null, today: Date = new Date()): boolean {
  if (!deployTarget) return false
  if (['Done', 'Paused', 'Backlog'].includes(status)) return false
  return deployTarget < midnight(today)
}
