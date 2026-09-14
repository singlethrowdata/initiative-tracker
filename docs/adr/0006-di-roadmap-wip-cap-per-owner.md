# ADR-0006: WIP cap is per-owner, not one shared team-wide number

## Status
Accepted

## Context
ADR-0004 introduced `wip_cap` (default 5) as one shared limit: "the team can only work on
N projects in Design/Build/Deploy at once," shown as a single "capacity: N / 5 projects"
chip. Checked against real data at the time, this read as globally overloaded (8 / 5, red)
even though the real per-person split (grouped by Owner — see below) was Darian Ward at 5
(exactly at his own limit) and Charles Blain at 3 (well under his). A shared pool conflates
two different people's separate bandwidth into one number and produces a false "the team is
over capacity" signal when only one person actually is. Asked directly, the answer was:
capacity should go up to 5 each — i.e. each person gets their own cap of 5, not a shared cap
of 5 split between both.

Notably, `di_config` already had an orphaned, never-wired `wip_cap_per_owner` key (value 4)
sitting unused in the live database. Tracing it back: ADR-0001 records that the *original*,
pre-teardown D+I Roadmap build modeled capacity exactly this way — "each of the two D+I team
members could have up to 4 projects in flight, assigned by an `owner` field" — before ADR-0001
replaced it with the shared weekly-budget model. The orphaned key is that original model's
leftover default, never deleted. This ADR revives that original per-owner-by-`owner`
mechanism (not a new invention), at the now-confirmed value of 5, without reverting
ADR-0001's separate `capacity_budget_weeks`/"Next opening" model, which stays shared.

**Owner, not Architect, is the grouping key.** Both fields exist on every row and can
differ (e.g. one project's `architect` is Charles Blain but its `owner` is Darian Ward).
`lexicon.md`'s own "Owner vs Architect" entry is explicit: "Architect designed/spec'd it,
Owner is currently building it" — i.e. Owner is the person whose active build bandwidth a
WIP cap is supposed to measure, not Architect (who may have only spec'd the work once,
then handed it off). This matches ADR-0001's historical precedent above, which capped
`owner`, not `architect`. GanttRow's existing "architect: <b>…</b>" in-flight label is a
separate, unrelated UI element (design-credit attribution shown while a row is in-flight)
and is unaffected by this decision.

## Decision
`computeCapacityView()` no longer returns a single `currentDrawCount` / `wipCap` pair. It
returns `drawByOwner: { owner: string; count: number }[]` — one entry per distinct `owner`
value found among rows in a `WIP_CAP_STATUSES` (Design/Build/Deploy) stage right now — plus
`wipCapPerOwner`, the same limit (default 5) applied to each entry individually. A row with
no owner set groups under `'Unassigned'` rather than being silently dropped.

Config: `di_config.wip_cap` (shared) is retired — the row is deleted from the live database
and no longer seeded by `ensure-schema`. `di_config.wip_cap_per_owner` (the previously-orphaned
key) is now the live, wired config value, seeded to `'5'`, with `DEFAULT_WIP_CAP_PER_OWNER = 5`
as the code-level fallback in `lib/di-scheduling.ts`.

`CapacityChip` renders one chip per `drawByOwner` entry ("Darian Ward: 5 / 5", "Charles
Blain: 3 / 5"), each independently red if that owner's own count exceeds `wipCapPerOwner`.
This is a clean cutover, not an additive display: there is no more single team-wide chip.

ADR-0004's `WIP_CAP_STATUSES` set and the soft (non-blocking) philosophy both carry over
unchanged — only the grouping (shared pool → per-owner) and the config key changed.
ADR-0001/ADR-0003's `capacity_budget_weeks`-driven queue-wait math is untouched: it was
already keyed off aggregate throughput, not per-owner WIP, and still isn't — the two models
coexist exactly as ADR-0001's "Consequences" section anticipated when it first separated them.

## Consequences
The header can now show one owner at cap while another has room — which is the accurate
picture, not a regression. A future reader adding a third team member needs no code change:
`drawByOwner` is derived from whatever `owner` values are actually in play, not a hardcoded
pair. If different people should ever have *different* caps (e.g. one working part-time on
D+I), `wipCapPerOwner` would need to become a per-owner map instead of one shared number —
not needed today, flagged here so a future reader knows it was considered and deliberately
deferred. A future reader should not be surprised that `owner` (not `architect`) drives this
— re-read `lexicon.md`'s "Owner vs Architect" entry before changing it back.
