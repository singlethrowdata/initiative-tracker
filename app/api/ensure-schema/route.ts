import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { sql } from '@/lib/db'

export async function GET() {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await sql`ALTER TABLE community_comments ADD COLUMN IF NOT EXISTS is_concern BOOLEAN DEFAULT FALSE`
  return NextResponse.json({ ok: true })
}
