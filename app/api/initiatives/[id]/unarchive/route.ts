import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { sql } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: Request, { params }: Params) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  await sql`
    UPDATE initiatives SET
      is_archived = false,
      archived_at = null,
      approval_status = null,
      approval_token = null,
      approval_requested_at = null,
      status = 'In Progress',
      completion_desc = '',
      sop_link = '',
      completion_links = '',
      completion_requester_email = null,
      completion_requester_name = null,
      updated_at = ${new Date().toISOString()}
    WHERE id = ${id}
  `

  return NextResponse.json({ success: true })
}
