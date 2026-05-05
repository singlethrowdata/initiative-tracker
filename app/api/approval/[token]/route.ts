import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { sendApprovalDecisionEmail } from '@/lib/email'

type Params = { params: Promise<{ token: string }> }

export async function GET(req: Request, { params }: Params) {
  const { token } = await params
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  const [initiative] = await sql`
    SELECT id, task_name, created_by, approval_status
    FROM initiatives WHERE approval_token = ${token}
  `

  if (!initiative) {
    return new Response('<h2>Invalid or expired approval link.</h2>', {
      status: 404,
      headers: { 'Content-Type': 'text/html' },
    })
  }

  if (initiative.approval_status === 'approved') {
    return new Response('<h2>This initiative has already been approved.</h2>', {
      headers: { 'Content-Type': 'text/html' },
    })
  }

  if (action === 'approve') {
    await sql`
      UPDATE initiatives SET
        approval_status = 'approved',
        status = 'Approved',
        is_archived = true,
        archived_at = ${new Date().toISOString()},
        approval_token = null,
        updated_at = ${new Date().toISOString()}
      WHERE id = ${initiative.id}
    `
    await sendApprovalDecisionEmail(
      initiative.created_by as string, initiative.task_name as string, 'approved'
    )
    return new Response(
      `<html><body style="font-family:Arial;max-width:500px;margin:60px auto;text-align:center">
        <h2 style="color:#6B8F71">&#10003; Initiative Approved</h2>
        <p><strong>${initiative.task_name}</strong> has been marked as complete.</p>
        <p style="color:#8899A6;font-size:12px">The requester has been notified.</p>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    )
  }

  if (action === 'deny') {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    return Response.redirect(`${appUrl}/approval/deny?token=${token}`, 302)
  }

  return new Response('<h2>Invalid action.</h2>', {
    status: 400,
    headers: { 'Content-Type': 'text/html' },
  })
}

export async function POST(req: Request, { params }: Params) {
  const { token } = await params
  const body = await req.json()

  const [initiative] = await sql`
    SELECT id, task_name, created_by FROM initiatives WHERE approval_token = ${token}
  `
  if (!initiative) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })

  await sql`
    UPDATE initiatives SET
      approval_status = 'denied',
      status = 'In Progress',
      approval_token = null,
      updated_at = ${new Date().toISOString()}
    WHERE id = ${initiative.id}
  `
  await sendApprovalDecisionEmail(
    initiative.created_by as string, initiative.task_name as string, 'denied', body.comment
  )
  return NextResponse.json({ success: true })
}
