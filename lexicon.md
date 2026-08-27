# Lexicon

Domain terms for the initiative-tracker app. Created during the D+I Roadmap rebuild `/probe` session (2026-08-26), after three prior UI attempts were built and torn down.

## D+I Roadmap
The Data & Innovation team's build-pipeline tracker: a company-visible tab showing every project the team needs to build, its stage, and how it's tracking against its estimated timeline.
**Not to be confused with:** Initiative — the general company-wide work item tracked in the existing Tracker tab. A D+I Roadmap project may optionally link to one Initiative, but most don't.

## Stage
One phase of building a D+I Roadmap project: Design, Build, QA, Awaiting Approval, or Deploy — each with its own estimated duration in weeks.
**Not to be confused with:** Status — the full status set (Backlog, In Queue, Design, Build, QA, Awaiting Approval, Deploy, Done, Blocked, Paused) includes non-stage states like Backlog and Blocked.

## Capacity Budget
The combined weekly bandwidth (in person-weeks, currently ~1.5) that the two D+I team members have available for builds, shared as one pool rather than split per person. Powers the "Next opening" ETA and per-project target dates.
**Not to be confused with:** WIP Cap — a separate, simpler concurrency limit (see below). The old per-owner WIP cap model (fixed in-flight slot count assigned to each person individually) that Capacity Budget itself replaced is gone entirely; WIP Cap is a new, distinct concept, not a return to that model — it's shared, not per-person.

## WIP Cap
The hard limit (currently 5, shared, not per-person) on how many D+I Roadmap projects can be in the Design, Build, or Deploy stage at once — "how many things we can actually be working on at a time." A project in QA, Awaiting Approval, or Blocked ("waiting on someone else") doesn't count against it, even though it's still shown as active on the Gantt and still has a real target date. Informational, not a hard gate — going over is a health signal, not a block on starting new work (same philosophy as Capacity Budget).
**Not to be confused with:** Capacity Budget — WIP Cap answers "how many projects are we touching right now," Capacity Budget answers "how fast is the backlog draining." They're tracked and displayed separately.

## In-Flight
A project is In-Flight — and draws down the WIP Cap — only while in the Design, Build, or Deploy stage. QA, Awaiting Approval, Blocked, and Paused don't draw down the WIP Cap because no one is actively building on them right now, even though QA/Awaiting Approval/Blocked still count toward Capacity Budget's target-date math (that project still has real calendar time riding on it).

## Buffered Estimate
A project's raw stage-week estimate (from its Size Preset or a custom entry) multiplied by 1.33x before being used to compute target dates, correcting for systematic underestimation.

## Size Preset
A T-shirt size (Small/Medium/Large) that sets default per-stage week estimates for a new project; editable per project after creation.

## Queue Order
The sequence backlog projects will be worked in. Defaults to descending RICE Score; either team member can manually drag a project to override its position, which then holds until moved again.
**Not to be confused with:** RICE Score alone — RICE sets the *default* order but a manual drag always wins once applied.

## RICE Score
Reach/Impact/Confidence/Effort scoring per project. Drives the default Queue Order; also the answer to "impact" in the original ask.

## Owner vs Architect
Two distinct people-roles on a D+I Roadmap project: Architect designed/spec'd it, Owner is currently building it. They can differ per project. Neither role drives Capacity Budget allocation — capacity is shared, not assigned per person.

## Variance
How far a project's current progress is from its Buffered Estimate target date. Shown as a Gantt bar length/position vs. today per project, and rolled up into one team-wide headline number (e.g. "3.2 weeks behind across active projects").

## Initiative Link
An optional, not-always-present connection from a D+I Roadmap project to an Initiative in the main Tracker. Shown only as a small badge/icon on the linked project's Gantt row — never a dedicated grouping or filter.
