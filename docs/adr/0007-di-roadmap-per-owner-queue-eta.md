# ADR-0007: Queue ETA runs on per-owner concurrent WIP, not a shared serial budget

## Status
Accepted

## Context
ADR-0001/0003 modeled "how soon does a queued project start" as a single-server queue:
sum every started-and-ahead project's buffered Design+Build+QA+Deploy weeks into one
number, divide by one shared `capacity_budget_weeks` (a "starting guess, not calibrated
from real data," default 1.5 person-weeks/week, never actually set in `di_config` — every
environment ran on the placeholder). ADR-0006 later introduced a completely separate,
more accurate model for a different number (`drawByOwner`/`wipCapPerOwner`: each owner can
have up to 5 projects in Design/Build/Deploy at once) but explicitly left the ADR-0003
queue-ETA math untouched, on the reasoning that the two models measured different things
and could coexist.

That coexistence broke down once real per-project stage estimates actually existed. A
sheet-sync gap had left 27 initiatives with all `*_wks` columns at 0, which silently kept
the ADR-0003 sum near zero. Backfilling real estimates (this session, same day) exposed
the model for what it was: cumulative ahead-weeks across the *entire* team, divided by one
throughput number, produced 65–90 week (1.3–1.7 year) "next opening" ETAs — not a display
bug, the direct, correct output of a queue model that assumes all work is serialized
through one shared bottleneck.

Direct feedback on seeing those numbers: the team does not work that way. Design/Build/QA
run concurrently across both owners (exactly what ADR-0006 already models); QA and
Awaiting Approval don't consume build bandwidth and shouldn't count against a queue ETA
either (ADR-0006 already excluded them from `WIP_CAP_STATUSES` for the same reason — the
inconsistency was that ADR-0003's `IN_FLIGHT_STATUSES`/`fullInFlightWeeks` still included
QA for this specific calculation); and higher-priority queued work should be able to jump
ahead of lower-priority work waiting on the same owner, which no version of the queue math
modeled at all.

## Decision
Retire the ADR-0003 single-server model for `finishes_in_weeks` (Queue rows) and
`nextOpening` (the "Next opening" card for a hypothetical new project). Replace it with a
per-owner multi-server simulation built directly on ADR-0006's existing `WIP_CAP_STATUSES`
mechanism:

- For each owner, seed a slot-opening timeline: `wipCapPerOwner` slots total, one opening
  at `t=0` for each currently-free slot, and one future opening per in-flight
  (`WIP_CAP_STATUSES`) project at that project's own remaining Design/Build/Deploy weeks
  (elapsed time in its current stage subtracted from estimate, plus every later WIP stage's
  full estimate).
- That owner's queued/backlog items claim openings in **priority order first, then
  `queue_position`** — a High-priority item claims a slot ahead of a same-owner Medium/Low
  item regardless of where it sits in the drag-ordered list. This is the concrete
  implementation of "priority can escalate": no separate manual escalation action exists;
  raising an item's Priority field is what moves it up the effective line.
- Claiming an opening at time `t` books that slot until `t + fullInFlightWeeks(item)`,
  pushing a new future opening back onto that owner's timeline — so a backlog longer than
  the current in-flight count still resolves correctly by simulating each subsequent
  hand-off, not just the first cap-many items.
- `finishes_in_weeks` = the claimed start time + that item's own full 5-stage calendar
  duration (Design+Build+QA+Approval+Deploy, buffered) — QA/Approval still take real
  calendar time once work is underway, they just don't gate *when* it can start.
- `nextOpening(preset)` (unowned hypothetical project) takes the earliest opening across
  all owners' post-simulation timelines — "whoever's free first picks it up" — plus the
  preset's own full calendar duration.
- `fullInFlightWeeks()` drops QA from its sum (now Design+Build+Deploy only, matching
  `WIP_CAP_STATUSES` exactly) since it also feeds `calcRiceScore`'s effort denominator,
  which should likewise not charge QA/Approval time against a project's effort score.
  `IN_FLIGHT_STATUSES` (Design/Build/QA/Deploy) is unchanged and kept — it's a separate,
  correctly-scoped set used only for GanttRow's "architect: …" in-flight display, not for
  any capacity or effort math.
- `capacity_budget_weeks` is retired end-to-end: the `di_config` row, the
  `ResolvedDiConfig`/`DiConfig` field, the `computeCapacityView` parameter, the
  `ensure-schema` seed line, and `DEFAULT_CAPACITY_BUDGET_WEEKS`. No UI ever exposed it for
  editing, so this is a clean removal, not a deprecation.
- Per-project target-date/variance math (`calcPhaseTargets`, the Active Gantt's "+2.1wk"
  number) is untouched — it already chains through all 5 stages as real calendar time for
  *that one project's own schedule*, which is a different question from team-wide queue
  contention and was never part of this bug.

Separately (same investigation, same fix pass): a start-less Paused/Blocked item (no
`date_start`) previously fell back to "today" as its implied start, producing a nonsensical
negative ("ahead of schedule") variance for work that hasn't begun. `variance_weeks`/
`target_date` are now `null` whenever `date_start` is null — matches how Queued items
already show no variance.

## Consequences
Queue ETAs now reflect actual concurrent throughput (two owners × 5 slots each, minus
whatever's already running) instead of one shared bottleneck rate — expect them to drop
sharply from the 65–90 week figures that prompted this ADR. A future reader adding a third
owner needs no code change, same as ADR-0006's `drawByOwner`. A future reader wanting a
*manual* "bump this to the front regardless of priority" escalation action (distinct from
raising Priority) would need a new mechanism — not built here, since the ask was answered
by the existing Priority field once it actually drives ordering.
