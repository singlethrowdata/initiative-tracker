import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { google } from 'googleapis'

export async function GET() {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
  const sheets = google.sheets({ version: 'v4', auth })

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.DOC_REGISTRY_SHEET_ID!,
    range: 'Employee Directory!1:3',
  })

  return NextResponse.json({
    sheetId: process.env.DOC_REGISTRY_SHEET_ID,
    rows: res.data.values,
  })
}
