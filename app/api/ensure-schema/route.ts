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
  await sql`ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS doc_department TEXT`
  await sql`ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS doc_visible_to TEXT`
  await sql`ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS ts_departments TEXT`
  await sql`ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS ts_username TEXT`
  await sql`ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS ts_notes TEXT`
  await sql`ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS ts_password TEXT`
  await sql`ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS ts_tab TEXT`
  await sql`ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS ts_category TEXT`
  await sql`ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS ts_use_case TEXT`
  await sql`ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS ts_responsible TEXT`
  await sql`ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS ts_google_signin BOOLEAN DEFAULT FALSE`
  await sql`ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS ts_client_owner TEXT`
  await sql`ALTER TABLE community_comments ADD COLUMN IF NOT EXISTS is_concern BOOLEAN DEFAULT FALSE`
  await sql`ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS is_resolved BOOLEAN DEFAULT FALSE`
  await sql`ALTER TABLE updates ADD COLUMN IF NOT EXISTS blocked BOOLEAN DEFAULT FALSE`
  await sql`ALTER TABLE updates ADD COLUMN IF NOT EXISTS blocked_reason TEXT`
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

  // D+I Roadmap
  await sql`
    CREATE TABLE IF NOT EXISTS di_initiatives (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      queue_number INT,
      tier TEXT DEFAULT '3 - Explore',
      type TEXT DEFAULT 'Other',
      project_name TEXT NOT NULL,
      architect TEXT DEFAULT '',
      owner TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Backlog',
      status_note TEXT DEFAULT '',
      date_start TIMESTAMPTZ,
      date_completed TIMESTAMPTZ,
      description TEXT DEFAULT '',
      outcome TEXT DEFAULT '',
      link TEXT DEFAULT '',
      pace_id TEXT DEFAULT '',
      accelo_id TEXT DEFAULT '',
      rice_r NUMERIC,
      rice_i NUMERIC,
      rice_c NUMERIC,
      design_wks NUMERIC DEFAULT 0,
      build_wks NUMERIC DEFAULT 0,
      qa_wks NUMERIC DEFAULT 0,
      approval_wks NUMERIC DEFAULT 0,
      deploy_wks NUMERIC DEFAULT 0,
      tracker_initiative_id UUID UNIQUE REFERENCES initiatives(id) ON DELETE SET NULL,
      created_by TEXT DEFAULT '',
      created_by_name TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS di_status_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      di_initiative_id UUID NOT NULL REFERENCES di_initiatives(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      entered_at TIMESTAMPTZ DEFAULT NOW(),
      exited_at TIMESTAMPTZ,
      blocker_category TEXT,
      blocker_note TEXT,
      set_by_email TEXT DEFAULT '',
      set_by_name TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_di_status_history_initiative ON di_status_history(di_initiative_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_di_status_history_open ON di_status_history(di_initiative_id) WHERE exited_at IS NULL`
  await sql`
    CREATE TABLE IF NOT EXISTS di_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `
  await sql`
    INSERT INTO di_config (key, value) VALUES
      ('wip_cap_per_owner', '4'),
      ('high_load_weeks_threshold', '8'),
      ('overload_weeks_threshold', '12'),
      ('size_presets', '{"Small":{"design":1,"build":1,"qa":1,"approval":1,"deploy":0.5},"Medium":{"design":2,"build":3,"qa":2,"approval":1,"deploy":1},"Large":{"design":3,"build":6,"qa":3,"approval":2,"deploy":1}}')
    ON CONFLICT (key) DO NOTHING
  `
  await sql`ALTER TABLE di_initiatives ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'Medium'`

  return NextResponse.json({ ok: true })
}
