import { sql } from './db'
import { TeamMember } from '@/types'

const CACHE_TTL = 5 * 60 * 1000
let cache: { data: TeamMember[]; ts: number } | null = null

export async function getActiveTeam(): Promise<TeamMember[]> {
  if (cache && Date.now() - cache.ts < CACHE_TTL) return cache.data

  const data = await sql`
    SELECT * FROM team_members WHERE status = 'Active' ORDER BY display_name
  `
  cache = { data: data as TeamMember[], ts: Date.now() }
  return cache.data
}

export function invalidateTeamCache() {
  cache = null
}

export async function getTeamMap(): Promise<Record<string, string>> {
  const team = await getActiveTeam()
  return Object.fromEntries(team.map(m => [m.email, m.display_name]))
}

export async function getTeamByName(): Promise<Record<string, string>> {
  const team = await getActiveTeam()
  return Object.fromEntries(team.map(m => [m.display_name, m.email]))
}

export async function isAdmin(email: string): Promise<boolean> {
  if (email.toLowerCase() === 'tech@singlethrow.com') return true
  const [data] = await sql`
    SELECT role FROM team_members WHERE email = ${email.toLowerCase()}
  `
  return data?.role === 'Admin'
}

export async function getMemberName(email: string): Promise<string> {
  const [data] = await sql`
    SELECT display_name FROM team_members WHERE email = ${email.toLowerCase()}
  `
  if (data?.display_name) return data.display_name as string
  return email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}
