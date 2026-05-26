import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { google } from 'googleapis'

export async function GET() {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sheetId = process.env.DOC_REGISTRY_SHEET_ID
  const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY

  if (!sheetId || !serviceEmail || !privateKey) {
    return NextResponse.json({
      error: 'Missing env vars',
      hasSheetId: !!sheetId,
      hasServiceEmail: !!serviceEmail,
      hasPrivateKey: !!privateKey,
    })
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: serviceEmail,
        private_key: privateKey.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })
    const sheets = google.sheets({ version: 'v4', auth })
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'Employee Directory',
    })
    const rows = res.data.values ?? []
    return NextResponse.json({
      ok: true,
      sheetId,
      serviceEmail,
      rowCount: rows.length,
      headers: rows[0] ?? [],
      sampleRow: rows[1] ?? [],
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message, code: e.code, status: e.status })
  }
}
