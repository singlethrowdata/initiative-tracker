import { google } from 'googleapis'

function getSheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  return google.sheets({ version: 'v4', auth })
}

export async function appendToDocRegistry(initiative: {
  task_name: string
  department: string
  description: string
  completion_desc: string
  sop_link: string
  created_by_name: string
  completed_by_name: string
  completed_at: string
}) {
  const sheetId = process.env.DOC_REGISTRY_SHEET_ID
  if (!sheetId) { console.error('DOC_REGISTRY_SHEET_ID not set'); return }

  try {
    const sheets = getSheets()
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'Initiatives!A:H',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          initiative.task_name,
          initiative.department,
          initiative.description,
          initiative.completion_desc,
          initiative.sop_link,
          initiative.created_by_name,
          initiative.completed_by_name,
          initiative.completed_at,
        ]],
      },
    })
  } catch (e) {
    console.error('appendToDocRegistry failed:', e)
  }
}

export async function appendToTechStack(initiative: {
  task_name: string
  type: string
  department: string
  completion_desc: string
  participants: string
  sop_link: string
  completion_links: string
  completed_by_name: string
  completed_at: string
}) {
  const sheetId = process.env.TECH_STACK_SHEET_ID
  if (!sheetId) { console.error('TECH_STACK_SHEET_ID not set'); return }

  try {
    const sheets = getSheets()
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'Initiatives!A:I',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          initiative.task_name,
          initiative.type,
          initiative.department,
          initiative.completion_desc,
          initiative.participants,
          initiative.sop_link,
          initiative.completion_links,
          initiative.completed_by_name,
          initiative.completed_at,
        ]],
      },
    })
  } catch (e) {
    console.error('appendToTechStack failed:', e)
  }
}
