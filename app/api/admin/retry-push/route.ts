import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { sql } from '@/lib/db'
import { getActiveTeam } from '@/lib/team'

const DEPT_CODE: Record<string, string> = {
  'Operations': 'OPS', 'Content': 'CONT', 'SEO': 'SEO', 'Design': 'CR',
  'CRO': 'CRO', 'Data & Innovation': 'DATA', 'Account Managers': 'AM',
  'Sales': 'SDR', 'Finance': 'FIN', 'Paid': 'PAID',
  'Executive Assistant': 'EA', 'Organization': 'ORG',
}

export async function GET(req: Request) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id') ?? ''

  if (searchParams.get('action') === 'unarchive') {
    await sql`
      UPDATE initiatives SET
        is_archived = false, archived_at = null,
        approval_status = null, approval_token = null,
        approval_requested_at = null, status = 'In Progress',
        completion_desc = '', sop_link = '', completion_links = '',
        updated_at = ${new Date().toISOString()}
      WHERE id = ${id}
    `
    return NextResponse.json({ success: true, message: 'Initiative reset to In Progress' })
  }
  const [initiative] = await sql`SELECT * FROM initiatives WHERE id = ${id}`
  if (!initiative) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const docApiUrl = (process.env.DOC_REGISTRY_API_URL ?? '').replace(/\/$/, '')
  const docApiSecret = process.env.DOC_REGISTRY_INTERNAL_SECRET

  const results: Record<string, unknown> = {}

  // Doc Registry push
  if (docApiUrl && docApiSecret) {
    const visibleToEmails = initiative.doc_visible_to
      ? (initiative.doc_visible_to as string).split(',').map((e: string) => e.trim()).filter(Boolean)
      : await getActiveTeam().then((t: { email: string }[]) => t.map(m => m.email).filter(Boolean))

    try {
      const res = await fetch(`${docApiUrl}/api/internal/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-secret': docApiSecret },
        body: JSON.stringify({
          formData: {
            documentType: (initiative.doc_type ?? 'SOP') as string,
            department: (initiative.doc_department || DEPT_CODE[(initiative.department ?? '') as string] || initiative.department) as string,
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
      })
      results.docRegistry = { status: res.status, body: await res.json() }
    } catch (e) {
      results.docRegistry = { error: String(e) }
    }
  } else {
    results.docRegistry = { skipped: true, docApiUrl, hasSecret: !!docApiSecret }
  }

  // Tech Stack — internal API (writes to the hub's Neon DB; hub encrypts the password)
  const tsApiUrl = process.env.TECH_STACK_API_URL
  const tsSecret = process.env.TECH_STACK_INTERNAL_SECRET
  if (tsApiUrl && tsSecret && initiative.ts_tab) {
    try {
      const res = await fetch(`${tsApiUrl}/api/tools/internal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-secret': tsSecret },
        body: JSON.stringify({
          tool_name: initiative.task_name,
          tab: initiative.ts_tab,
          description: initiative.description ?? '',
          access_url: initiative.completion_links ?? '',
          responsible_for_update: initiative.ts_responsible ?? '',
          department: initiative.ts_departments ?? initiative.department ?? '',
          category: initiative.ts_category ?? '',
          use_case: initiative.ts_use_case ?? '',
          client_owner: initiative.ts_client_owner ?? null,
          created_by: initiative.completion_requester_email ?? initiative.created_by,
          password: initiative.ts_password ?? '',
          notes: initiative.ts_notes ?? '',
          tags: initiative.doc_tags ?? '',
          username: initiative.ts_username ?? '',
        }),
      })
      results.techStack = { status: res.status, body: await res.text() }
    } catch (e) {
      results.techStack = { error: String(e) }
    }
  } else {
    results.techStack = { skipped: true, hasApiUrl: !!tsApiUrl, hasSecret: !!tsSecret, ts_tab: initiative.ts_tab }
  }

  return NextResponse.json(results)
}
