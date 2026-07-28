import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { google, sheets_v4 } from 'googleapis'
import { sql } from '@/lib/db'

// The original D+I Roadmap Sheet (see DI-roadmap repo README/CLAUDE.md) — being
// decommissioned in favor of this tab. One-time migration only.
const SHEET_ID = '13dC687-gUaynmqx_ju93s7EohjRfg7VH7Uknisn2HxM'
const TAB = 'ROADMAP'

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

async function readTab(sheets: sheets_v4.Sheets, tab: string): Promise<Record<string, string>[]> {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: tab })
  const rows = res.data.values || []
  if (rows.length < 2) return []
  const headers = rows[0] as string[]
  return rows.slice(1).map(row => {
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => { if (h) obj[h] = String((row as unknown[])[i] ?? '') })
    return obj
  })
}

const num = (v?: string): number | null => {
  const n = Number(v)
  return v && Number.isFinite(n) ? n : null
}
const dt = (v?: string): string | null => (v ? v : null)

export async function GET(req: Request) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const sheets = getSheets()

  if (searchParams.get('run') !== 'yes') {
    try {
      const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${TAB}!1:1` })
      return NextResponse.json({ headers: (res.data.values?.[0] as string[]) ?? [] })
    } catch (e: unknown) {
      return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
    }
  }

  const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM di_initiatives`
  if (count > 0 && searchParams.get('force') !== 'yes') {
    return NextResponse.json(
      { error: `di_initiatives already has ${count} rows — pass ?force=yes to re-import anyway.` },
      { status: 409 }
    )
  }

  const errors: Array<{ project?: string; error: string }> = []
  let imported = 0

  try {
    const rows = await readTab(sheets, TAB)

    for (const r of rows) {
      const project = r['Project']
      if (!project) continue

      try {
        const status = r['Status'] || 'Backlog'
        const [row] = await sql`
          INSERT INTO di_initiatives (
            queue_number, tier, type, project_name, architect, owner, status, status_note,
            date_start, date_completed, description, outcome, link, pace_id, accelo_id,
            rice_r, rice_i, rice_c, design_wks, build_wks, qa_wks, approval_wks, deploy_wks,
            created_by_name
          ) VALUES (
            ${num(r['P#'])}, ${r['Tier'] || '3 - Explore'}, ${r['Type'] || 'Other'}, ${project},
            ${r['Architect'] || ''}, ${r['Owner'] || ''}, ${status}, ${r['Status Note'] || ''},
            ${dt(r['Date Start'])}, ${dt(r['Date Completed'])}, ${r['Description'] || ''},
            ${r['Outcome'] || ''}, ${r['Link to Document'] || ''}, ${r['PACE ID'] || ''}, ${r['Accelo ID'] || ''},
            ${num(r['RICE R'])}, ${num(r['RICE I'])}, ${num(r['RICE C (%)'])},
            ${num(r['Design Wks']) ?? 0}, ${num(r['Build Wks']) ?? 0}, ${num(r['QA Wks']) ?? 0}, 0,
            ${num(r['Deploy Wks']) ?? 0}, ${r['Owner'] || r['Architect'] || ''}
          )
          RETURNING id
        `
        await sql`
          INSERT INTO di_status_history (di_initiative_id, status, set_by_name)
          VALUES (${row.id}, ${status}, 'D+I Sheet import')
        `
        imported++
      } catch (e) {
        errors.push({ project, error: e instanceof Error ? e.message : String(e) })
      }
    }

    return NextResponse.json({ ok: true, imported, errors: errors.slice(0, 50), errorCount: errors.length })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e), errors: errors.slice(0, 50) },
      { status: 500 }
    )
  }
}
