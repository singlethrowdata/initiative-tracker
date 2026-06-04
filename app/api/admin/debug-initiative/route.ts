import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { sql } from '@/lib/db'

export async function GET(req: Request) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  const [initiative] = id
    ? await sql`SELECT * FROM initiatives WHERE id = ${id}`
    : await sql`SELECT * FROM initiatives ORDER BY updated_at DESC LIMIT 1`

  return NextResponse.json({
    initiative: {
      id: initiative?.id,
      task_name: initiative?.task_name,
      type: initiative?.type,
      status: initiative?.status,
      is_archived: initiative?.is_archived,
      sop_link: initiative?.sop_link,
      doc_type: initiative?.doc_type,
      doc_department: initiative?.doc_department,
      doc_purpose: initiative?.doc_purpose,
      doc_context: initiative?.doc_context,
      doc_owner: initiative?.doc_owner,
      doc_tags: initiative?.doc_tags,
      doc_visible_to: initiative?.doc_visible_to ? '(set)' : null,
      ts_tab: initiative?.ts_tab,
      ts_departments: initiative?.ts_departments,
      ts_responsible: initiative?.ts_responsible,
      ts_username: initiative?.ts_username,
    },
    env: {
      DOC_REGISTRY_API_URL: process.env.DOC_REGISTRY_API_URL ?? 'NOT SET',
      DOC_REGISTRY_INTERNAL_SECRET: process.env.DOC_REGISTRY_INTERNAL_SECRET ? 'SET' : 'NOT SET',
      TECH_STACK_API_URL: process.env.TECH_STACK_API_URL ?? 'NOT SET',
      TECH_STACK_INTERNAL_SECRET: process.env.TECH_STACK_INTERNAL_SECRET ? 'SET' : 'NOT SET',
    },
  })
}
