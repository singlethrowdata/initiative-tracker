import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { sendApprovalDecisionEmail } from '@/lib/email'
import { appendToDocRegistry, appendToTechStack } from '@/lib/sheets'
import { getActiveTeam } from '@/lib/team'

const DEPT_CODE: Record<string, string> = {
  'Operations': 'OPS', 'Content': 'CONT', 'SEO': 'SEO', 'Design': 'CR',
  'CRO': 'CRO', 'Data & Innovation': 'DATA', 'Account Managers': 'AM',
  'Sales': 'SDR', 'Finance': 'FIN', 'Paid': 'PAID',
  'Executive Assistant': 'EA', 'Organization': 'ORG',
}

type Params = { params: Promise<{ token: string }> }

export async function GET(req: Request, { params }: Params) {
  const { token } = await params
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  const [initiative] = await sql`
    SELECT * FROM initiatives WHERE approval_token = ${token}
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
    const now = new Date().toISOString()
    await sql`
      UPDATE initiatives SET
        approval_status = 'approved',
        status = 'Approved',
        is_archived = true,
        archived_at = ${now},
        approval_token = null,
        updated_at = ${now}
      WHERE id = ${initiative.id}
    `

    const completedByName = (initiative.completion_requester_name ?? initiative.created_by_name ?? '') as string

    // Fire-and-forget — sheet writes shouldn't block the confirmation page
    Promise.all([
      appendToDocRegistry({
        task_name: initiative.task_name as string,
        department: (initiative.department ?? '') as string,
        description: (initiative.description ?? '') as string,
        completion_desc: (initiative.completion_desc ?? '') as string,
        sop_link: (initiative.sop_link ?? '') as string,
        created_by_name: (initiative.created_by_name ?? '') as string,
        completed_by_name: completedByName,
        completed_at: now,
      }),
      appendToTechStack({
        task_name: initiative.task_name as string,
        type: (initiative.type ?? '') as string,
        department: (initiative.department ?? '') as string,
        completion_desc: (initiative.completion_desc ?? '') as string,
        participants: (initiative.participants ?? '') as string,
        sop_link: (initiative.sop_link ?? '') as string,
        completion_links: (initiative.completion_links ?? '') as string,
        completed_by_name: completedByName,
        completed_at: now,
      }),
    ]).catch(err => console.error('Sheet write failed:', err))

    // Push to Doc Registry if SOP link + doc fields were provided
    if (initiative.sop_link && initiative.doc_purpose && initiative.doc_context && initiative.doc_owner) {
      const docApiUrl = process.env.DOC_REGISTRY_API_URL
      const docApiSecret = process.env.DOC_REGISTRY_INTERNAL_SECRET
      if (docApiUrl && docApiSecret) {
        const visibleToEmails = initiative.doc_visible_to
          ? (initiative.doc_visible_to as string).split(',').map((e: string) => e.trim()).filter(Boolean)
          : await getActiveTeam().then((t: { email: string }[]) => t.map(m => m.email).filter(Boolean))
        fetch(`${docApiUrl}/api/internal/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-secret': docApiSecret },
          body: JSON.stringify({
            formData: {
              documentType: (initiative.doc_type ?? 'SOP') as string,
              department: (initiative.doc_department || DEPT_CODE[(initiative.department ?? '') as string] || (initiative.department ?? '')) as string,
              purpose: initiative.doc_purpose as string,
              context: initiative.doc_context as string,
              owner: initiative.doc_owner as string,
              summary: (initiative.completion_desc ?? initiative.description ?? '') as string,
              fileLink: initiative.sop_link as string,
              tags: (initiative.doc_tags ?? '') as string,
              visibleToEmails,
            },
            userEmail: (initiative.completion_requester_email ?? initiative.created_by) as string,
          }),
        }).catch(err => console.error('Doc Registry push failed:', err))
      }
    }

    // Push to Tech Stack Hub if this is a Tool initiative with tab filled in
    if (initiative.type === 'Tool' && initiative.ts_tab) {
      const tsApiUrl = process.env.TECH_STACK_HUB_URL
      const tsApiSecret = process.env.TECH_STACK_INTERNAL_SECRET
      if (tsApiUrl && tsApiSecret) {
        fetch(`${tsApiUrl}/api/tools/internal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-secret': tsApiSecret },
          body: JSON.stringify({
            tool_name: initiative.task_name as string,
            tab: initiative.ts_tab as string,
            description: (initiative.description ?? '') as string,
            access_url: (initiative.completion_links ?? '') as string,
            department: (initiative.ts_departments ?? initiative.department ?? '') as string,
            responsible_for_update: (initiative.ts_responsible ?? '') as string,
            username: (initiative.ts_username ?? '') as string,
            notes: (initiative.ts_notes ?? '') as string,
            client_owner: (initiative.ts_client_owner ?? null),
            tags: (initiative.doc_tags ?? '') as string,
            created_by: (initiative.completion_requester_email ?? initiative.created_by) as string,
          }),
        }).catch(err => console.error('Tech Stack Hub push failed:', err))
      }
    }

    const approvedRecipients = [...new Set([
      initiative.completion_requester_email as string,
      initiative.created_by as string,
    ].filter(Boolean))]
    await Promise.all(
      approvedRecipients.map(email =>
        sendApprovalDecisionEmail(email, initiative.task_name as string, 'approved')
          .catch(err => console.error('Approval email failed to', email, err))
      )
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
    SELECT id, task_name, created_by, completion_requester_email
    FROM initiatives WHERE approval_token = ${token}
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

  // Send to whoever submitted the completion request + the original creator (deduplicated)
  const recipients = [...new Set([
    initiative.completion_requester_email as string,
    initiative.created_by as string,
  ].filter(Boolean))]

  await Promise.all(
    recipients.map(email =>
      sendApprovalDecisionEmail(email, initiative.task_name as string, 'denied', body.comment)
        .catch(err => console.error('Denial email failed to', email, err))
    )
  )

  return NextResponse.json({ success: true })
}
