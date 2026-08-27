# ADR-0002: D+I Roadmap is company-wide visible, read-only for non-owners

## Status
Accepted

## Context
The stated goal at the start of this feature's original session was to show the rest of the company how backed up the D+I team is. Three internal-working-view-flavored builds were rejected in sequence ("too messy" → "too simplified" → "still wrong") without the audience ever being explicitly re-confirmed after the first attempt. During `/probe`, re-asking this directly surfaced that audience scope was genuinely undecided going into each rebuild, which plausibly contributed to inconsistent density/complexity across the three attempts.

## Decision
The tab is visible company-wide, not team-only. The two D+I team members get full create/edit controls (add project, change status, adjust estimates, reorder queue). Everyone else gets a read-only Gantt view with edit controls hidden entirely, not merely disabled.

## Consequences
Forces the visual design (Gantt bars with per-project and rollup variance) to be legible to non-technical, non-data-team viewers at a glance — it can't rely on internal shorthand or dense tabular data the way a team-only tool could. Makes reverting to a team-only view later a visible, noticeable change to a wider audience than before. Requires the read/write permission check to live in the page/API layer for this feature specifically, since the rest of the Tracker app does not currently distinguish edit access this way.
