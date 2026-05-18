import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { google } from 'googleapis'

export async function GET() {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sheetId = process.env.DOC_REGISTRY_SHEET_ID
  if (!sheetId) return NextResponse.json({ error: 'DOC_REGISTRY_SHEET_ID env var not set' })

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })
    const sheets = google.sheets({ version: 'v4', auth })

    // First get list of sheet tab names
    const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId })
    const tabNames = meta.data.sheets?.map(s => s.properties?.title) ?? []

    // Try to read the Employee Directory tab
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'Employee Directory!1:3',
    })

    return NextResponse.json({
      sheetId,
      tabNames,
      rows: res.data.values,
    })
  } catch (e: unknown) {
    return NextResponse.json({
      error: e instanceof Error ? e.message : String(e),
      sheetId,
    })
  }
}
