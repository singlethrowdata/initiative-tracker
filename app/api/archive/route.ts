import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { sql } from '@/lib/db'

export async function GET() {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await sql`
    SELECT * FROM initiatives WHERE is_archived = true ORDER BY archived_at DESC
  `
  return NextResponse.json(data)
}
