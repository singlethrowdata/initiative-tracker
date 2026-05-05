import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { sql } from '@/lib/db'

export async function GET(req: Request) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const archived = searchParams.get('archived') === 'true'

  const rows = await sql`
    SELECT * FROM initiatives WHERE is_archived = ${archived} ORDER BY created_at DESC
  `

  const cols = [
    'task_name', 'type', 'status', 'priority', 'department',
    'description', 'participants', 'waiting_on', 'start_date',
    'anticipated_end_date', 'actual_end_date', 'completion_desc',
    'sop_link', 'completion_links', 'created_by_name', 'completed_by_name',
    'created_at', 'updated_at',
  ]

  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return `"${s.replace(/"/g, '""')}"`
  }

  const csv = [
    cols.join(','),
    ...rows.map(r => cols.map(c => escape(r[c as keyof typeof r])).join(',')),
  ].join('\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="initiatives-${archived ? 'archive' : 'active'}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
