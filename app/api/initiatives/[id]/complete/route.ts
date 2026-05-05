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
      approval_status = 'pending',
      approval_token = ${token},
      approval_requested_at = ${new Date().toISOString()},
      completion_desc = ${body.final_summary ?? ''},
      sop_link = ${body.sop_link ?? ''},
      completion_links = ${body.tool_link ?? ''},
      participants = ${body.participants ?? initiative.participants},
      updated_at = ${new Date().toISOString()}
    WHERE id = ${id}
  `

  await sendApprovalRequestEmail(
    id,
    initiative.task_name as string,
    token,
    body.participants ?? initiative.participants,
    (initiative.department ?? '') as string,
    requesterName,
    email,
    body.final_summary,
    body.sop_link,
    body.tool_link
  )

  return NextResponse.json({ success: true })
}
