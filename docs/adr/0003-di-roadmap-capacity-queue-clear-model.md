# ADR-0003: D+I Roadmap capacity math is a shared-throughput queue-clear model

## Status
Accepted

## Context
The approved mockup (`docs/design/html/di-roadmap/index.html`) shows a capacity chip
("1.2 / 1.5 wk") and a "Next opening" headline with per-size start/finish estimates, but
every number in it is a hardcoded placeholder — the mockup's own inline comment says so
explicitly ("the real app derives these from the shared capacity budget + queue, per
docs/adr/0001"). ADR-0001 established *that* capacity is one shared weekly budget; it did
not specify the math. That's this ADR.

## Decision
Model the team as a single-server queue with a known weekly service rate:

- **Capacity budget** (`capacity_budget_weeks`, config-driven, default 1.5) is the team's
  combined throughput in person-weeks of buffered stage-work per calendar week — not a hard
  admission-control gate. Work can run over budget (the chip can show more committed than
  available); that's a health signal, not a block on starting new work.
- **Current draw** = count of initiatives currently In-Flight (Design/Build/QA/Deploy),
  1.0 each. Simple and legible; a project is either being actively worked or it isn't.
- **Next opening / queued ETA**: sum the buffered in-flight work (design+build+qa+deploy,
  buffered ×1.33 via size preset or custom weeks) still ahead of a point in the queue —
  every in-flight initiative's *remaining* stage-weeks (estimate minus elapsed time in its
  current stage) plus every queued initiative's *full* buffered in-flight weeks, in queue
  order. Divide that cumulative sum by the capacity budget to get calendar weeks until this
  slot opens. Awaiting Approval weeks are excluded from this sum (ADR-0001: approval doesn't
  draw the budget) but are added back on top of an individual project's own finish estimate,
  since approval still costs *that* project calendar time even though it doesn't block
  others.
- **Variance** (Gantt "+1.5wk" / "on track"): compare today against a target date computed
  the same way — start date plus cumulative buffered weeks of every stage up to and
  including the project's current stage (approval included only if it's the current stage).

## Consequences
Queue ETAs are a function of one shared cumulative-weeks number, matching ADR-0001's stated
goal ("either person can pick up any queued project without a scheduling rewrite"). The
model is a simplification — it doesn't account for a stage requiring both people at once, or
partial-week draw — acceptable because the audience (ADR-0002: company-wide, non-technical)
needs a legible trend line, not a precise resource-leveling solver. Revisit if real Done-tier
data shows the flat 1.0-per-in-flight-project draw is systematically wrong.
