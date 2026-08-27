# ADR-0001: D+I Roadmap uses a shared capacity budget, not per-owner WIP caps

## Status
Accepted

## Context
The original D+I Roadmap build (deleted this session, commit `7136787`) modeled capacity as a fixed WIP cap per owner — each of the two D+I team members could have up to 4 projects in flight, assigned by an `owner` field, and queue dates were computed by stacking each owner's buffered stage-weeks independently.

Three subsequent UI rebuilds on top of that model were rejected ("too messy" → "too simplified" → "still wrong, delete everything"). During the `/probe` session that followed the full teardown, the user identified — when asked directly whether to restore the old scheduling engine as-is — that the capacity *model* itself was wrong, not just the visuals: the two team members don't own fixed independent slots. Capacity is a shared, fluid pool, and it's better expressed as weekly bandwidth than as an item count.

## Decision
Capacity is modeled as one combined weekly budget (~1.5 person-weeks/week, config-driven, not hardcoded), consumed only by projects in the Design, Build, QA, or Deploy stage. Awaiting Approval, Blocked, and Paused projects don't draw against it. Queue order defaults to descending RICE score; a manual drag-to-reorder overrides and holds until moved again. The 1.33x under-estimation buffer and the Small/Medium/Large size presets from the original build are retained unchanged — the user's feedback never identified those as wrong, only the per-owner capacity split.

## Consequences
Makes "how far out is project N" a function of total committed stage-weeks against one shared number, so either person can pick up any queued project without a scheduling rewrite. Makes it harder to answer "is [person] individually overloaded" without a separate per-person load view added later. Precludes guaranteeing a specific person's capacity to a specific project ahead of time — the model no longer has a concept of per-owner reservation.
