import { neon } from '@neondatabase/serverless'

export const sql = neon(process.env.DATABASE_URL!)

// Allowed fields per table — prevents arbitrary column injection from req.json() spreads
const ALLOWED: Record<string, Set<string>> = {
  initiatives: new Set([
    'status', 'task_name', 'type', 'priority', 'description', 'notes',
    'participants', 'links', 'department', 'start_date', 'anticipated_end_date',
    'actual_end_date', 'waiting_on', 'waiting_on_set_at', 'is_archived', 'archived_at',
    'approval_status', 'approval_token', 'approval_requested_at', 'completion_desc',
    'sop_link', 'completion_links', 'completed_by', 'completed_by_name', 'completed_at',
    'last_waiting_on_reminder', 'updated_at',
  ]),
  updates: new Set([
    'description', 'assigned_to', 'links', 'waiting_on', 'target_date',
    'participants', 'completed', 'blocked', 'blocked_reason', 'updated_at',
  ]),
  community_posts: new Set(['title', 'content', 'is_resolved', 'updated_at']),
  personal_notes: new Set(['title', 'content', 'updated_at']),
  di_initiatives: new Set([
    'queue_position', 'priority', 'tier', 'type', 'project_name', 'architect', 'owner',
    'status', 'status_note', 'size_preset', 'date_start', 'date_completed', 'description',
    'outcome', 'link', 'pace_id', 'accelo_id', 'rice_r', 'rice_i', 'rice_c',
    'design_wks', 'build_wks', 'qa_wks', 'approval_wks', 'deploy_wks',
    'tracker_initiative_id', 'updated_at',
  ]),
  di_updates: new Set(['content', 'updated_at']),
}

export async function sqlUpdate(
  table: string,
  fields: Record<string, unknown>,
  whereId: string
): Promise<Record<string, unknown> | null> {
  const allowed = ALLOWED[table]
  const entries = Object.entries(fields).filter(
    ([k, v]) => v !== undefined && (!allowed || allowed.has(k))
  )
  if (!entries.length) return null

  const params: unknown[] = []
  const setClauses = entries.map(([k, v]) => {
    params.push(v)
    return `"${k}" = $${params.length}`
  })
  params.push(whereId)

  const query = `UPDATE "${table}" SET ${setClauses.join(', ')} WHERE id = $${params.length} RETURNING *`
  const rows = await (sql as unknown as { query: (q: string, p: unknown[]) => Promise<Record<string, unknown>[]> }).query(query, params)
  return rows[0] ?? null
}
