import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { sql } from '@/lib/db'
import { getMemberName } from '@/lib/team'
import { sendApprovalRequestEmail } from '@/lib/email'
import crypto from 'crypto'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Params) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const email = session.user.email.toLowerCase()
  const body = await req.json()

  const [initiative] = await sql`SELECT * FROM initiatives WHERE id = ${id}`
  if (!initiative) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const requesterName = await getMemberName(email)
  const token = crypto.randomUUID()

  await sql`
    UPDATE initiatives SET
      status = 'Awaiting Approval',
      approval_status = 'pending',
      approval_token = ${token},
      approval_requested_at = ${new Date().toISOString()},
      completion_desc = ${body.final_summary ?? ''},
      sop_link = ${body.sop_link ?? ''},
      completion_links = ${body.tool_link ?? ''},
      participants = ${body.participants ?? initiative.participants},
      completion_requester_email = ${email},
      completion_requester_name = ${requesterName},
      doc_type = ${body.doc_type ?? 'SOP'},
      doc_department = ${body.doc_department ?? ''},
      doc_visible_to = ${body.doc_visible_to ?? ''},
      doc_purpose = ${body.doc_purpose ?? ''},
      doc_context = ${body.doc_context ?? ''},
      doc_owner = ${body.doc_owner ?? ''},
      doc_tags = ${body.doc_tags ?? ''},
      ts_tab = ${body.ts_tab ?? ''},
      ts_category = ${body.ts_category ?? ''},
      ts_use_case = ${body.ts_use_case ?? ''},
      ts_responsible = ${body.ts_responsible ?? ''},
      ts_google_signin = ${body.ts_google_signin ?? false},
      ts_client_owner = ${body.ts_client_owner ?? ''},
      updated_at = ${new Date().toISOString()}
    WHERE id = ${id}
  `

  sendApprovalRequestEmail(
    id,
    initiative.task_name as string,
    token,
    body.participants ?? initiative.participants,
    (initiative.department ?? '') as string,
    requesterName,
    email,
    body.final_summary,
    body.sop_link,
    body.tool_link,
    (initiative.description ?? '') as string,
    (initiative.start_date ?? '') as string,
    (initiative.anticipated_end_date ?? '') as string,
  ).catch(console.error)

  return NextResponse.json({ success: true })
}
