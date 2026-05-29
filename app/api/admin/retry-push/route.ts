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

export async function POST(req: Request) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  const [initiative] = await sql`SELECT * FROM initiatives WHERE id = ${id}`
  if (!initiative) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const docApiUrl = (process.env.DOC_REGISTRY_API_URL ?? '').replace(/\/$/, '')
  const docApiSecret = process.env.DOC_REGISTRY_INTERNAL_SECRET
  const tsApiUrl = (process.env.TECH_STACK_HUB_URL ?? '').replace(/\/$/, '')
  const tsApiSecret = process.env.TECH_STACK_INTERNAL_SECRET

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
            summary: (initiative.completion_desc ?? initiative.description ?? '') as string,
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

  // Tech Stack push
  if (tsApiUrl && tsApiSecret) {
    try {
      const res = await fetch(`${tsApiUrl}/api/tools/internal`, {
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
          password: (initiative.ts_password ?? '') as string,
          notes: (initiative.ts_notes ?? '') as string,
          client_owner: (initiative.ts_client_owner ?? null),
          tags: (initiative.doc_tags ?? '') as string,
          created_by: (initiative.completion_requester_email ?? initiative.created_by) as string,
        }),
      })
      results.techStack = { status: res.status, body: await res.json() }
    } catch (e) {
      results.techStack = { error: String(e) }
    }
  } else {
    results.techStack = { skipped: true, tsApiUrl, hasSecret: !!tsApiSecret }
  }

  return NextResponse.json(results)
}
