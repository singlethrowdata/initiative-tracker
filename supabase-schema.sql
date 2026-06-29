-- ═══════════════════════════════════════════════════
-- SINGLE THROW — SHARED SCHEMA
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════

-- Team members (owned by Document Registry, shared across all apps)
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Employee' CHECK (role IN ('Admin', 'Department Head', 'Employee')),
  department TEXT,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  gmail_access_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initiatives (Tracker + Archive combined)
CREATE TABLE IF NOT EXISTS initiatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'Not Started',
  task_name TEXT NOT NULL,
  type TEXT DEFAULT '',
  priority TEXT DEFAULT 'Medium',
  waiting_on TEXT DEFAULT '',
  waiting_on_set_at TIMESTAMPTZ,
  start_date DATE,
  anticipated_end_date DATE,
  actual_end_date DATE,
  description TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  participants TEXT DEFAULT '',
  links TEXT DEFAULT '',
  department TEXT DEFAULT '',
  created_by TEXT DEFAULT '',
  created_by_name TEXT DEFAULT '',
  completed_by TEXT DEFAULT '',
  completed_by_name TEXT DEFAULT '',
  completed_at TIMESTAMPTZ,
  sop_link TEXT DEFAULT '',
  completion_desc TEXT DEFAULT '',
  completion_links TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_waiting_on_reminder TIMESTAMPTZ,
  approval_status TEXT DEFAULT '',
  approval_token TEXT,
  approval_requested_at TIMESTAMPTZ,
  is_archived BOOLEAN DEFAULT FALSE,
  archived_at TIMESTAMPTZ
);

-- Updates (sub-tasks per initiative)
CREATE TABLE IF NOT EXISTS updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initiative_id UUID NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
  user_email TEXT DEFAULT '',
  user_name TEXT DEFAULT '',
  description TEXT DEFAULT '',
  assigned_to TEXT DEFAULT '',
  links TEXT DEFAULT '',
  waiting_on TEXT DEFAULT '',
  target_date DATE,
  participants TEXT DEFAULT '',
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update comments
CREATE TABLE IF NOT EXISTS update_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  update_id UUID NOT NULL REFERENCES updates(id) ON DELETE CASCADE,
  user_email TEXT DEFAULT '',
  user_name TEXT DEFAULT '',
  content TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initiative notes (stream of notes per initiative)
CREATE TABLE IF NOT EXISTS initiative_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initiative_id UUID NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
  user_email TEXT DEFAULT '',
  user_name TEXT DEFAULT '',
  content TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Personal notes (private per user)
CREATE TABLE IF NOT EXISTS personal_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  title TEXT DEFAULT '',
  content TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Personal comments (notes on personal notes)
CREATE TABLE IF NOT EXISTS personal_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES personal_notes(id) ON DELETE CASCADE,
  content TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Community posts
CREATE TABLE IF NOT EXISTS community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT DEFAULT '',
  user_name TEXT DEFAULT '',
  title TEXT DEFAULT '',
  content TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Post likes (replaces liked_by CSV — count derived at query time)
CREATE TABLE IF NOT EXISTS post_likes (
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  PRIMARY KEY (post_id, user_email)
);

-- Community comments
CREATE TABLE IF NOT EXISTS community_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_email TEXT DEFAULT '',
  user_name TEXT DEFAULT '',
  content TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initiative ↔ Community idea links (a community post absorbed into an initiative)
CREATE TABLE IF NOT EXISTS initiative_community_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initiative_id UUID NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  linked_by TEXT DEFAULT '',
  linked_by_name TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (initiative_id, post_id)
);

-- ═══════════ INDEXES ═══════════
CREATE INDEX IF NOT EXISTS idx_initiatives_archived ON initiatives(is_archived);
CREATE INDEX IF NOT EXISTS idx_initiatives_status ON initiatives(status);
CREATE INDEX IF NOT EXISTS idx_initiatives_created_by ON initiatives(created_by);
CREATE INDEX IF NOT EXISTS idx_updates_initiative ON updates(initiative_id);
CREATE INDEX IF NOT EXISTS idx_update_comments_update ON update_comments(update_id);
CREATE INDEX IF NOT EXISTS idx_initiative_notes_initiative ON initiative_notes(initiative_id);
CREATE INDEX IF NOT EXISTS idx_personal_notes_user ON personal_notes(user_email);
CREATE INDEX IF NOT EXISTS idx_personal_comments_note ON personal_comments(note_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_created ON community_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_comments_post ON community_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_post ON post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_icl_initiative ON initiative_community_links(initiative_id);
CREATE INDEX IF NOT EXISTS idx_icl_post ON initiative_community_links(post_id);
CREATE INDEX IF NOT EXISTS idx_team_members_email ON team_members(email);
CREATE INDEX IF NOT EXISTS idx_team_members_status ON team_members(status);
