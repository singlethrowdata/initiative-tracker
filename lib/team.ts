import { sql } from './db'
import { getRegistryTeam } from './registry'
import { TeamMember } from '@/types'

const CACHE_TTL = 5 * 60 * 1000
let dbCache: { data: TeamMember[]; ts: number } | null = null

export async function getActiveTeam(): Promise<TeamMember[]> {
  // Primary: Doc Registry Google Sheet (live employee directory)
  const registry = await getRegistryTeam()
  if (registry.length > 0) return registry

  // Fallback: database (used if sheet is unavailable)
  if (dbCache && Date.now() - dbCache.ts < CACHE_TTL) return dbCache.data
  const data = await sql`SELECT * FROM team_members WHERE status = 'Active' ORDER BY display_name`
  dbCache = { data: data as TeamMember[], ts: Date.now() }
  return dbCache.data
}

export function invalidateTeamCache() {
  dbCache = null
}

export async function getTeamMap(): Promise<Record<string, string>> {
  const team = await getActiveTeam()
  return Object.fromEntries(team.map(m => [m.email, m.display_name]))
}

export async function getTeamByName(): Promise<Record<string, string>> {
  const team = await getActiveTeam()
  return Object.fromEntries(team.map(m => [m.display_name, m.email]))
}

const HARDCODED_ADMINS = ['tech@singlethrow.com', 'submissions@singlethrow.com']

export async function isAdmin(email: string): Promise<boolean> {
  if (HARDCODED_ADMINS.includes(email.toLowerCase())) return true
  const [data] = await sql`SELECT role FROM team_members WHERE email = ${email.toLowerCase()}`
  return data?.role === 'Admin'
}

export async function getMemberName(email: string): Promise<string> {
  const team = await getActiveTeam()
  const member = team.find(m => m.email === email.toLowerCase())
  if (member) return member.display_name

  const [data] = await sql`SELECT display_name FROM team_members WHERE email = ${email.toLowerCase()}`
  if (data?.display_name) return data.display_name as string
  return email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}
