# ADR-0005: submissions@singlethrow.com is a permanent D+I Roadmap write-access identity

## Status
Accepted

## Context
ADR-0002 granted create/edit control to "the two D+I team members" (`cblain@singlethrow.com`,
`dward@singlethrow.com`) and left everyone else read-only. STM's shared admin/deploy identity,
`submissions@singlethrow.com` (used for git pushes and Vercel production deploys per this
repo's `CLAUDE.md` ship sequence), is also the account used to sign into the app itself in
practice — and hit exactly the read-only wall ADR-0002 describes: no "+ Add project," no
drag-to-reorder, no "Edit stages." Asked directly whether this was a one-off testing
allowance or should stick, the answer was: permanent.

## Decision
`submissions@singlethrow.com` is added to `di_config.team_emails` alongside `cblain@` and
`dward@`, granting it the same permanent create/edit control ADR-0002 defined — not a
temporary override. This is codified in three places so it survives a fresh environment,
not just today's live database row:
- `lib/di-scheduling.ts` — `DEFAULT_TEAM_EMAILS` (the fallback `getDiConfig()` uses if the
  `di_config` row is ever missing)
- `app/api/ensure-schema/route.ts` — the seed `INSERT ... ON CONFLICT DO NOTHING` for a
  fresh database
- The live `di_config.team_emails` row itself (already updated directly, since granting
  write access via the app's own `PATCH /api/di-config` requires write access — a
  chicken-and-egg problem for the first grant)

This does **not** change ADR-0002's underlying read/write model (still exactly one gate:
`di_config.team_emails`) or ADR-0001/ADR-0004's capacity math, which is keyed off each
project's own `owner`/`architect` fields, not `team_emails` — adding a third write-access
identity doesn't make it a third person consuming build capacity.

## Consequences
Three sign-ins now bypass the read-only view instead of two. `lib/di-scheduling.ts`'s
`DEFAULT_TEAM_EMAILS` comment and `docs/adr/0002`'s "two D+I team members" phrasing now
describe different things — ADR-0002's original decision (a company-wide read-only view
with a small, named write-access allowlist) still holds; only the allowlist's membership
changed. A future reader diffing `team_emails` against ADR-0002 should land here, not
assume drift or a bug.
