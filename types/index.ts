export interface TeamMember {
  id: string
  email: string
  display_name: string
  role: 'Admin' | 'Department Head' | 'Employee'
  department?: string
  status: 'Active' | 'Inactive'
  created_at: string
}

export interface Initiative {
  id: string
  status: string
  task_name: string
  type: string
  priority: string
  waiting_on: string
  waiting_on_set_at: string | null
  start_date: string
  anticipated_end_date: string
  actual_end_date: string
  description: string
  notes: string
  participants: string
  links: string
  department: string
  created_by: string
  created_by_name: string
  completed_by: string
  completed_by_name: string
  completed_at: string | null
  sop_link: string
  completion_desc: string
  completion_links: string
  created_at: string
  updated_at: string
  last_waiting_on_reminder: string | null
  approval_status: string
  approval_token: string | null
  approval_requested_at: string | null
  is_archived: boolean
  archived_at: string | null
}

export interface Update {
  id: string
  initiative_id: string
  user_email: string
  user_name: string
  description: string
  assigned_to: string
  links: string
  waiting_on: string
  target_date: string
  participants: string
  completed: boolean
  blocked: boolean
  blocked_reason: string
  created_at: string
}

export interface UpdateComment {
  id: string
  update_id: string
  user_email: string
  user_name: string
  content: string
  created_at: string
}

export interface NoteComment {
  id: string
  note_id: string
  user_email: string
  user_name: string
  content: string
  created_at: string
}

export interface InitiativeNote {
  id: string
  initiative_id: string
  user_email: string
  user_name: string
  content: string
  created_at: string
  note_comments: NoteComment[]
}

export interface PersonalNote {
  id: string
  user_email: string
  title: string
  content: string
  created_at: string
  updated_at: string
}

export interface PersonalComment {
  id: string
  note_id: string
  content: string
  created_at: string
}

export interface CommunityPost {
  id: string
  user_email: string
  user_name: string
  title: string
  content: string
  created_at: string
  updated_at: string
  likes: number
  liked_by_user?: boolean
  is_resolved: boolean
}

export interface CommunityComment {
  id: string
  post_id: string
  user_email: string
  user_name: string
  content: string
  is_concern: boolean
  created_at: string
}

export interface CommunityIdeaLink {
  id: string
  initiative_id: string
  post_id: string
  title: string
  content: string
  user_name: string
  user_email: string
  created_at: string
  linked_at: string
  linked_by_name: string
  likes: number
  comment_count: number
  is_resolved: boolean
}

export interface InitialData {
  user: { email: string; name: string }
  canDelete: boolean
  teamList: TeamMember[]
}

export interface AiRecommendation {
  id: string
  type: 'milestone' | 'note'
  description: string
  assigned_to: string
  target_date: string
  approved: boolean
}

export interface DiStatusHistoryEntry {
  id: string
  status: string
  entered_at: string
  exited_at: string | null
  blocker_category: string | null
  blocker_note: string | null
  set_by_email?: string
  set_by_name?: string
}

export interface DiUpdate {
  id: string
  di_initiative_id: string
  user_email: string
  user_name: string
  content: string
  created_at: string
}

export interface DiInitiative {
  id: string
  queue_position: number | null
  priority: string
  tier: string
  type: string
  project_name: string
  architect: string
  owner: string
  status: string
  status_note: string
  size_preset: string
  date_start: string | null
  date_completed: string | null
  description: string
  outcome: string
  link: string
  pace_id: string
  accelo_id: string
  rice_r: number | null
  rice_i: number | null
  rice_c: number | null
  design_wks: number
  build_wks: number
  qa_wks: number
  approval_wks: number
  deploy_wks: number
  tracker_initiative_id: string | null
  tracker_initiative_name?: string | null
  created_by: string
  created_by_name: string
  created_at: string
  updated_at: string
  history: DiStatusHistoryEntry[]
  // computed by the API from lib/di-scheduling.ts — not stored columns
  in_flight: boolean
  rice_score: number | null
  target_date: string | null
  variance_weeks: number | null
  starts_in_weeks: number | null
}

export interface DiConfig {
  capacity_budget_weeks: number
  wip_cap: number
  size_presets: Record<string, { design: number; build: number; qa: number; approval: number; deploy: number }>
  team_emails: string[]
}
