import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { google } from 'googleapis'

const SHEET_ID = process.env.TECH_STACK_SHEET_ID
const SHEET_TAB = 'Initiatives'

function getSheets() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? '{}')
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  return google.sheets({ version: 'v4', auth })
}

// Append a completed initiative row to the Tech Stack Hub sheet
export async function POST(req: Request) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!SHEET_ID) return NextResponse.json({ error: 'Tech Stack sheet not configured' }, { status: 503 })

  const body = await req.json()
  const sheets = getSheets()

  const row = [
    body.task_name ?? '',
    body.type ?? '',
    body.department ?? '',
    body.completion_desc ?? '',
    body.participants ?? '',
    body.sop_link ?? '',
    body.completion_links ?? '',
    body.completed_by_name ?? '',
    body.completed_at ?? new Date().toISOString(),
  ]

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_TAB}!A:I`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  })

  return NextResponse.json({ success: true })
}
