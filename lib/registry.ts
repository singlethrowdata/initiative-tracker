import { google } from 'googleapis'
import { TeamMember } from '@/types'

const SHEET_ID = process.env.DOC_REGISTRY_SHEET_ID!
const CACHE_TTL = 5 * 60 * 1000
let cache: { data: TeamMember[]; ts: number } | null = null

export function invalidateRegistryCache() { cache = null }

const toList = (v?: string) => (v ?? '').split(',').map(x => x.trim()).filter(Boolean)
const isYes = (v?: string) => /^(yes|true|y|x|✓)$/i.test((v ?? '').trim())

function getSheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
  return google.sheets({ version: 'v4', auth })
}

function findCol(headers: string[], ...patterns: RegExp[]): number {
  for (const pat of patterns) {
    const i = headers.findIndex(h => pat.test(h))
    if (i >= 0) return i
  }
  return -1
}

export async function getRegistryTeam(): Promise<TeamMember[]> {
  if (cache && Date.now() - cache.ts < CACHE_TTL) return cache.data
  try {
    const sheets = getSheets()
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Employee Directory',
    })

    const rows = res.data.values ?? []
    if (rows.length < 2) return []

    const rawHeaders = rows[0] as string[]
    const headers = rawHeaders.map(h => h.toLowerCase().trim())

    const nameIdx = findCol(headers,
      /^name$/, /^full.?name$/, /^employee.?name$/, /^display.?name$/, /^contact.?name$/
    )
    const emailIdx = findCol(headers,
      /^email$/, /^work.?email$/, /^email.?address$/, /^e.?mail$/
    )
    const statusIdx = findCol(headers,
      /^status$/, /^employment.?status$/, /^employment$/, /^active$/
    )
    // Hub permission columns (Admin + Head Of). Head Of falls back to the legacy
    // "Departments" header for sheets not yet migrated; Role is the final legacy fallback.
    const adminIdx = findCol(headers, /^admin$/)
    const headOfIdx = findCol(headers, /^head.?of$/, /^departments$/)
    const deptIdx = findCol(headers, /^department$/)
    const roleIdx = findCol(headers, /^role$/)

    if (nameIdx < 0 || emailIdx < 0) {
      console.error('Employee Directory: could not find name/email columns. Headers:', rawHeaders)
      return []
    }

    const members: TeamMember[] = []
    for (const rawRow of rows.slice(1) as string[][]) {
      const email = (rawRow[emailIdx] ?? '').trim().toLowerCase()
      const name = (rawRow[nameIdx] ?? '').trim()
      if (!email || !name || !email.includes('@')) continue

      if (statusIdx >= 0) {
        const status = (rawRow[statusIdx] ?? '').trim().toLowerCase()
        if (/^(inactive|terminated|left|no|off ?board)/i.test(status)) continue
      }

      const admin = adminIdx >= 0 ? isYes(rawRow[adminIdx]) : (roleIdx >= 0 && rawRow[roleIdx] === 'Admin')
      const headsDepts = headOfIdx >= 0 ? toList(rawRow[headOfIdx]) : []
      const role: TeamMember['role'] = admin ? 'Admin' : (headsDepts.length > 0 ? 'Department Head' : 'Employee')

      members.push({
        id: '',
        email,
        display_name: name,
        role,
        department: deptIdx >= 0 ? (rawRow[deptIdx] ?? '').trim() || undefined : undefined,
        status: 'Active',
        created_at: '',
      })
    }

    cache = { data: members, ts: Date.now() }
    return members
  } catch (e) {
    console.error('Failed to read Employee Directory:', e)
    return []
  }
}

