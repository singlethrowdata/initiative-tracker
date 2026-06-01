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
