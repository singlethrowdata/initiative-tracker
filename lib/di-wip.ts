import { sql } from '@/lib/db'
import { IN_FLIGHT_STATUSES } from '@/lib/di-scheduling'

const NIL_ID = '00000000-0000-0000-0000-000000000000'

/** Is this owner already at (or over) their WIP cap of In Flight work? Awaiting Approval
 * doesn't count — see docs/adr/0001-awaiting-approval-excluded-from-wip.md — so a slot
 * frees up the moment something moves there, not just when it's Done. */
export async function wipCapReached(owner: string, excludeId?: string): Promise<boolean> {
  if (!owner) return false

  const [cfg] = await sql`SELECT value FROM di_config WHERE key = 'wip_cap_per_owner'`
  const cap = Number(cfg?.value ?? 4)

  const [{ n }] = await sql`
    SELECT COUNT(*)::int AS n FROM di_initiatives
    WHERE owner = ${owner}
      AND status = ANY(${IN_FLIGHT_STATUSES})
      AND id != ${excludeId ?? NIL_ID}
  `
  return n >= cap
}
