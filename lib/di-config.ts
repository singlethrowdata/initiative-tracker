// DB-access glue for the D+I Roadmap config table (di_config). Deliberately kept
// separate from lib/di-scheduling.ts, which stays free of `sql` calls per its own
// house rule — this file is the only place that reads/writes di_config.
import { sql } from './db'
import {
  DEFAULT_CAPACITY_BUDGET_WEEKS,
  DEFAULT_SIZE_PRESETS,
  DEFAULT_TEAM_EMAILS,
  DEFAULT_WIP_CAP,
  SizePreset,
} from './di-scheduling'

export interface ResolvedDiConfig {
  capacityBudgetWeeks: number
  wipCap: number
  sizePresets: Record<string, SizePreset>
  teamEmails: string[]
}

function parseJson<T>(raw: string | undefined, fallback: T): T {
  if (raw == null) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/** Reads di_config, falling back to the scheduling engine's defaults for any
 * key that's missing or unparseable (e.g. before ensure-schema has ever seeded it). */
export async function getDiConfig(): Promise<ResolvedDiConfig> {
  const rows = await sql`SELECT key, value FROM di_config`
  const byKey = new Map<string, string>((rows as { key: string; value: string }[]).map(r => [r.key, r.value]))

  const capacityBudgetWeeks = (() => {
    const n = parseJson<number>(byKey.get('capacity_budget_weeks'), DEFAULT_CAPACITY_BUDGET_WEEKS)
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_CAPACITY_BUDGET_WEEKS
  })()

  const wipCap = (() => {
    const n = parseJson<number>(byKey.get('wip_cap'), DEFAULT_WIP_CAP)
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_WIP_CAP
  })()

  const sizePresets = parseJson<Record<string, SizePreset>>(byKey.get('size_presets'), DEFAULT_SIZE_PRESETS)
  const teamEmails = parseJson<string[]>(byKey.get('team_emails'), DEFAULT_TEAM_EMAILS)

  return { capacityBudgetWeeks, wipCap, sizePresets, teamEmails }
}

/** ADR-0002: the two D+I team members get full create/edit; everyone else is read-only. */
export async function isDiTeamMember(email: string): Promise<boolean> {
  const { teamEmails } = await getDiConfig()
  const target = email.toLowerCase()
  return teamEmails.some(e => e.toLowerCase() === target)
}
