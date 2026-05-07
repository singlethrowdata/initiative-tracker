import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { google } from 'googleapis'

const SHEET_ID = '1jDCDCvuCKAG46b58k93iUrAKC5OXUphIzBKBYtpfVHE'
const TABS = [
  'Tracker', 'Archive', 'Updates', 'UpdateComments',
  'InitiativeNotes', 'Community', 'Comments', 'Personal', 'PersonalComments',
]

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

// GET — preview headers from each tab
export async function GET() {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sheets = getSheets()
  const result: Record<string, string[]> = {}

  for (const tab of TABS) {
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `${tab}!1:1`,
      })
      result[tab] = res.data.values?.[0] ?? []
    } catch (e: unknown) {
      result[tab] = [`ERROR: ${e instanceof Error ? e.message : String(e)}`]
    }
  }

  return NextResponse.json(result)
}
