import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { sql } from '@/lib/db'

export async function GET() {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await sql`ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS completion_requester_email TEXT`
  await sql`ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS completion_requester_name TEXT`
  await sql`ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS doc_type TEXT`
  await sql`ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS doc_purpose TEXT`
  await sql`ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS doc_context TEXT`
  await sql`ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS doc_owner TEXT`
  await sql`ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS doc_tags TEXT`
  await sql`ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS ts_tab TEXT`
  await sql`ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS ts_category TEXT`
  await sql`ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS ts_use_case TEXT`
  await sql`ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS ts_responsible TEXT`
  await sql`ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS ts_google_signin BOOLEAN DEFAULT FALSE`
  await sql`ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS ts_client_owner TEXT`
  await sql`ALTER TABLE community_comments ADD COLUMN IF NOT EXISTS is_concern BOOLEAN DEFAULT FALSE`
  await sql`ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS is_resolved BOOLEAN DEFAULT FALSE`
  await sql`
    CREATE TABLE IF NOT EXISTS note_comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      note_id UUID NOT NULL REFERENCES initiative_notes(id) ON DELETE CASCADE,
      user_email TEXT NOT NULL,
      user_name TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  return NextResponse.json({ ok: true })
}
