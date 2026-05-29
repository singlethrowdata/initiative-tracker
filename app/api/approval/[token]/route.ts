import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { sendApprovalDecisionEmail } from '@/lib/email'
import { appendToDocRegistry, appendToTechStack } from '@/lib/sheets'
import { getActiveTeam } from '@/lib/team'
import crypto from 'crypto'

function encryptForTechStack(text: string): { encrypted: string; iv: string } {
  if (!text || !process.env.TECH_STACK_ENCRYPTION_KEY) return { encrypted: '', iv: '' }
  const key = Buffer.from(process.env.TECH_STACK_ENCRYPTION_KEY, 'hex')
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    encrypted: `${encrypted.toString('base64')}:${tag.toString('base64')}`,
    iv: iv.toString('base64'),
  }
}

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
        status = 'Completed',
        is_archived = true,
        archived_at = ${now},
        approval_token = null,
        updated_at = ${now}
      WHERE id = ${initiative.id}
    `

    const completedByName = (initiative.completion_requester_name ?? initiative.created_by_name ?? '') as string
    const docApiUrl = (process.env.DOC_REGISTRY_API_URL ?? '').replace(/\/$/, '')
    const docApiSecret = process.env.DOC_REGISTRY_INTERNAL_SECRET
    const tsApiUrl = (process.env.TECH_STACK_HUB_URL ?? '').replace(/\/$/, '')
    const tsApiSecret = process.env.TECH_STACK_INTERNAL_SECRET

    const pushes: Promise<unknown>[] = []

    // Google Sheet writes (legacy log)
    pushes.push(
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
      })
    )

    // Doc Registry API push (requires sop_link + doc fields)
    if (initiative.sop_link && initiative.doc_purpose && initiative.doc_context && initiative.doc_owner && docApiUrl && docApiSecret) {
      const visibleToEmails = initiative.doc_visible_to
        ? (initiative.doc_visible_to as string).split(',').map((e: string) => e.trim()).filter(Boolean)
        : await getActiveTeam().then((t: { email: string }[]) => t.map(m => m.email).filter(Boolean))
      pushes.push(
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
              summary: (initiative.completion_desc || initiative.description || '') as string,
              fileLink: initiative.sop_link as string,
              tags: (initiative.doc_tags ?? '') as string,
              visibleToEmails,
            },
            userEmail: (initiative.completion_requester_email ?? initiative.created_by) as string,
          }),
        }).then(r => r.json()).then(d => console.log('Doc Registry push:', d)).catch(err => console.error('Doc Registry push failed:', err))
      )
    } else if (initiative.sop_link) {
      console.log('Doc Registry push skipped — missing fields:', {
        doc_purpose: initiative.doc_purpose, doc_context: initiative.doc_context,
        doc_owner: initiative.doc_owner, docApiUrl: !!docApiUrl, docApiSecret: !!docApiSecret,
      })
    }

    // Tech Stack Hub — direct Supabase insert (bypasses internal API)
    if (initiative.type === 'Tool' && initiative.ts_tab) {
      const supabaseUrl = process.env.TECH_STACK_SUPABASE_URL
      const supabaseKey = process.env.TECH_STACK_SUPABASE_KEY
      if (supabaseUrl && supabaseKey) {
        const { encrypted: password_encrypted, iv: password_iv } = encryptForTechStack((initiative.ts_password ?? '') as string)
        const toolId = crypto.randomUUID().replace(/-/g, '').substring(0, 8)
        pushes.push(
          fetch(`${supabaseUrl}/rest/v1/tools`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`,
              'apikey': supabaseKey,
              'Prefer': 'return=minimal',
            },
            body: JSON.stringify({
              id: toolId,
              tool_name: initiative.task_name,
              tab: initiative.ts_tab,
              type: (initiative.ts_category ?? '') as string,
              description: (initiative.description ?? '') as string,
              access_url: (initiative.completion_links ?? '') as string,
              responsible_for_update: (initiative.ts_responsible ?? '') as string,
              department: (initiative.ts_departments ?? initiative.department ?? '') as string,
              category: (initiative.ts_category ?? '') as string,
              use_case: (initiative.ts_use_case ?? '') as string,
              client_owner: (initiative.ts_client_owner ?? null),
              google_signin: false,
              created_by: (initiative.completion_requester_email ?? initiative.created_by) as string,
              created_date: now.split('T')[0],
              password_encrypted,
              password_iv,
              notes: (initiative.ts_notes ?? '') as string,
              tags: (initiative.doc_tags ?? '') as string,
              username: (initiative.ts_username ?? '') as string,
            }),
          }).then(r => { console.log('Tech Stack Supabase push status:', r.status); return r.text() })
            .then(t => console.log('Tech Stack response:', t))
            .catch(err => console.error('Tech Stack Supabase push failed:', err))
        )
      } else {
        console.log('Tech Stack push skipped — TECH_STACK_SUPABASE_URL or TECH_STACK_SUPABASE_KEY not set')
      }
    }

    // Await all pushes so Vercel doesn't kill them before completion
    await Promise.allSettled(pushes)

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
