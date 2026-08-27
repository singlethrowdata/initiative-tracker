# ADR-0004: D+I Roadmap's shared capacity limit is a hard WIP cap, not the weekly-bandwidth number

## Status
Accepted

## Context
ADR-0001 modeled capacity as one combined weekly bandwidth number (`capacity_budget_weeks`,
~1.5 person-weeks/week), consumed by projects in the Design, Build, QA, or Deploy stage.
ADR-0003 turned that into the "Next opening" ETA math and a `currentDrawWeeks` chip
comparing an in-flight project *count* against that weekly-bandwidth number — already an
apples-to-oranges comparison (a headcount against a rate), flagged in ADR-0003's own
Consequences as a simplification to revisit.

Talking through it directly with the team surfaced the actual rule they use day to day:
Darian and Charles can only actively build on 5 projects at once, shared between them
(not split per person). Critically, a project in QA, Awaiting Approval, or Blocked
("waiting on someone else") does **not** count against that limit — it's no longer
tying up either person's build time, even though it's still real, ongoing work with its
own calendar time and target date.

## Decision
Introduce a second, separate config number, `wip_cap` (default 5, shared, config-driven
via `di_config` like `capacity_budget_weeks`), and a narrower status set,
`WIP_CAP_STATUSES = ['Design', 'Build', 'Deploy']` (deliberately excluding QA — the one
status ADR-0001's `IN_FLIGHT_STATUSES` got wrong for this purpose).

This is additive, not a replacement of ADR-0001/0003:
- `capacity_budget_weeks` + `IN_FLIGHT_STATUSES` (Design/Build/QA/Deploy) keep powering
  everything they already did — RICE effort scoring, per-project target dates, and the
  "Next opening" ETA for a hypothetical new project. None of that math changes.
- `wip_cap` + `WIP_CAP_STATUSES` power one new, separate number: `currentDrawCount` — a
  plain count of projects currently in Design/Build/Deploy, shown against the cap as
  "capacity: 8 / 5 projects" in the header chip. Same soft philosophy as ADR-0003: going
  over the cap is a health signal (and, checked against real data at the time of this
  ADR, they currently *are* over it — 8 in flight against a cap of 5), not a hard gate
  blocking new work from starting.

Queue Order (lexicon.md) is unchanged — "queued in order of how we're working on them" is
already exactly what the existing RICE-default-plus-manual-drag ordering does; this ADR
doesn't touch it.

## Consequences
The capacity chip now reads as a plain, legible project count instead of a
decimal-weeks-vs-headcount mismatch, correcting the ADR-0003 simplification called out at
the time. QA/Awaiting Approval/Blocked projects still appear on the Active Gantt with real
target dates and variance — they're just no longer holding one of the 5 shared build
slots. Two capacity numbers now exist side by side (`wip_cap` for "how many things are we
touching," `capacity_budget_weeks` for "how fast is the backlog draining") — a future
reader must not conflate them; `lib/di-scheduling.ts` keeps them as separate function
parameters and separate `CapacityView` fields to keep that boundary explicit in code, not
just in docs.
