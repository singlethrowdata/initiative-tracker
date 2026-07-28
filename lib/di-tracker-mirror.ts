// Mirror sync between a D+I Roadmap item and its Linked Initiative in the generic
// Tracker (see docs/adr and lexicon.md in the DI-roadmap repo for the "Mirror Sync" term).
// Each side keeps owning its own fields — this only relays specific signals across.
import { sql } from '@/lib/db'

// Names treated as "still the Innovation team's own work" rather than an external
// blocker, per the D+I lexicon's "Blocker Reason" entry.
const SELF_OWNER_NAMES = ['charles blain', 'darian ward']

function isSelfOwner(waitingOn: string): boolean {
  const v = waitingOn.toLowerCase()
  return SELF_OWNER_NAMES.some(name => v.includes(name))
}

/** Roadmap -> Tracker: a D+I status change posts a log entry into the linked
 * initiative's existing `updates` timeline. Plain insert, same shape as any other
 * update row — no new UI needed on the Tracker side. */
export async function mirrorStatusToTracker(params: {
  trackerInitiativeId: string
  newStatus: string
  actingEmail: string
  actingName: string
}) {
  const { trackerInitiativeId, newStatus, actingEmail, actingName } = params
  await sql`
    INSERT INTO updates (initiative_id, user_email, user_name, description)
    VALUES (${trackerInitiativeId}, ${actingEmail}, ${actingName}, ${`D+I Roadmap: status changed to ${newStatus}`})
  `
}

/** Tracker -> Roadmap: when an `updates` row on a Linked Initiative sets `waiting_on`
 * (or is marked blocked), mirror it into the D+I item's currently-open stage as a
 * Blocker Reason. If the wait is on Charles or Darian themselves, that's still the
 * team's own work, not an external cause, so it's tagged `internal_capacity` rather
 * than left unclassified. */
export async function mirrorWaitingOnToRoadmap(params: {
  trackerInitiativeId: string
  waitingOn: string
}) {
  const { trackerInitiativeId, waitingOn } = params
  if (!waitingOn) return

  const linked = await sql`
    SELECT id FROM di_initiatives WHERE tracker_initiative_id = ${trackerInitiativeId}
  `
  const diInitiativeId = (linked as unknown as { id: string }[])[0]?.id
  if (!diInitiativeId) return

  const category = isSelfOwner(waitingOn) ? 'internal_capacity' : 'other'

  await sql`
    UPDATE di_status_history
    SET blocker_category = ${category}, blocker_note = ${waitingOn}
    WHERE di_initiative_id = ${diInitiativeId} AND exited_at IS NULL
  `
}
