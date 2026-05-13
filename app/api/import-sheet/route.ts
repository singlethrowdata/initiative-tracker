import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { google, sheets_v4 } from 'googleapis'
import { sql } from '@/lib/db'
import { randomUUID } from 'crypto'

const SHEET_ID = '1jDCDCvuCKAG46b58k93iUrAKC5OXUphIzBKBYtpfVHE'
const TABS = [
  'Tracker', 'Archive', 'Updates', 'UpdateComments',
  'InitiativeNotes', 'Community', 'Comments', 'Personal', 'PersonalComments',
]

function getSheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
  return google.sheets({ version: 'v4', auth })
}

async function readTab(sheets: sheets_v4.Sheets, tab: string): Promise<Record<string, string>[]> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: tab,
  })
  const rows = res.data.values || []
  if (rows.length < 2) return []
  const headers = rows[0] as string[]
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => {
      if (h) obj[h] = String((row as unknown[])[i] ?? '')
    })
    return obj
  })
}

const dt = (v?: string) => (v == null || v === '' ? null : v)
const bool = (v?: string) => v === 'TRUE' || v === 'true' || v === '1'

async function rawInsert(table: string, row: Record<string, unknown>) {
  const entries = Object.entries(row).filter(([, v]) => v !== undefined)
  const cols = entries.map(([k]) => `"${k}"`).join(',')
  const placeholders = entries.map((_, i) => `$${i + 1}`).join(',')
  const query = `INSERT INTO "${table}" (${cols}) VALUES (${placeholders})`
  await (sql as unknown as { query: (q: string, p: unknown[]) => Promise<unknown> }).query(
    query,
    entries.map(([, v]) => v),
  )
}

// Maps short sheet IDs (e.g. "68ab756b") to full UUIDs, deterministically per-import
class IdMap {
  private m = new Map<string, string>()
  get(oldId: string): string {
    if (!oldId) return randomUUID()
    if (!this.m.has(oldId)) this.m.set(oldId, randomUUID())
    return this.m.get(oldId)!
  }
}

export async function GET(req: Request) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const sheets = getSheets()

  if (searchParams.get('run') !== 'yes') {
    const result: Record<string, string[]> = {}
    for (const tab of TABS) {
      try {
        const res = await sheets.spreadsheets.values.get({
          spreadsheetId: SHEET_ID,
          range: `${tab}!1:1`,
        })
        result[tab] = (res.data.values?.[0] as string[]) ?? []
      } catch (e: unknown) {
        result[tab] = [`ERROR: ${e instanceof Error ? e.message : String(e)}`]
      }
    }
    return NextResponse.json(result)
  }

  const errors: Array<{ table: string; id?: string; error: string }> = []

  try {
    const [tracker, archive, updates, updateComments, initNotes, community, comments, personal, personalComments] = await Promise.all([
      readTab(sheets, 'Tracker'),
      readTab(sheets, 'Archive'),
      readTab(sheets, 'Updates'),
      readTab(sheets, 'UpdateComments'),
      readTab(sheets, 'InitiativeNotes'),
      readTab(sheets, 'Community'),
      readTab(sheets, 'Comments'),
      readTab(sheets, 'Personal'),
      readTab(sheets, 'PersonalComments'),
    ])

    await sql`TRUNCATE personal_comments, personal_notes, post_likes, community_comments, community_posts, initiative_notes, update_comments, updates, initiatives CASCADE`

    // Separate ID namespaces so that, e.g., a post ID and an initiative ID never collide
    const initiativeIds = new IdMap()
    const updateIds = new IdMap()
    const postIds = new IdMap()
    const noteIds = new IdMap()

    const counts: Record<string, number> = {}

    // 1. Tracker → initiatives (active)
    let n = 0
    for (const r of tracker) {
      if (!r.id || !r.taskName) continue
      try {
        await rawInsert('initiatives', {
          id: initiativeIds.get(r.id),
          status: r.status || 'Not Started',
          task_name: r.taskName,
          type: r.type || '',
          priority: r.priority || 'Medium',
          waiting_on: r.waitingOn || '',
          start_date: dt(r.startDate),
          anticipated_end_date: dt(r.anticipatedEndDate),
          actual_end_date: dt(r.actualEndDate),
          description: r.description || '',
          notes: r.notes || '',
          participants: r.participants || '',
          links: r.links || '',
          department: r.department || '',
          created_by: r.createdBy || '',
          created_by_name: r.createdByName || '',
          completed_by: r.completedBy || '',
          completed_by_name: r.completedByName || '',
          completed_at: dt(r.completedAt),
          sop_link: r.sopLink || '',
          completion_desc: r.completionDesc || '',
          completion_links: r.completionLinks || '',
          created_at: dt(r.createdAt),
          updated_at: dt(r.updatedAt),
          waiting_on_set_at: dt(r.waitingOnSetAt),
          last_waiting_on_reminder: dt(r.lastWaitingOnReminder),
          approval_status: r.approvalStatus || '',
          approval_token: r.approvalToken || null,
          approval_requested_at: dt(r.approvalRequestedAt),
          is_archived: false,
        })
        n++
      } catch (e) {
        errors.push({ table: 'initiatives', id: r.id, error: e instanceof Error ? e.message : String(e) })
      }
    }
    counts.tracker = n

    // 2. Archive → initiatives (archived)
    n = 0
    for (const r of archive) {
      if (!r.id || !r.taskName) continue
      try {
        await rawInsert('initiatives', {
          id: initiativeIds.get(r.id),
          status: r.status || 'Not Started',
          task_name: r.taskName,
          type: r.type || '',
          priority: r.priority || 'Medium',
          waiting_on: r.waitingOn || '',
          start_date: dt(r.startDate),
          anticipated_end_date: dt(r.anticipatedEndDate),
          actual_end_date: dt(r.actualEndDate),
          description: r.description || '',
          notes: r.notes || '',
          participants: r.participants || '',
          links: r.links || '',
          department: r.department || '',
          created_by: r.createdBy || '',
          created_by_name: r.createdByName || '',
          completed_by: r.completedBy || '',
          completed_by_name: r.completedByName || '',
          completed_at: dt(r.completedAt),
          sop_link: r.sopLink || '',
          completion_desc: r.completionDesc || '',
          completion_links: r.completionLinks || '',
          created_at: dt(r.createdAt),
          updated_at: dt(r.updatedAt),
          waiting_on_set_at: dt(r.waitingOnSetAt),
          last_waiting_on_reminder: dt(r.lastWaitingOnReminder),
          is_archived: true,
          archived_at: dt(r.archivedAt),
        })
        n++
      } catch (e) {
        errors.push({ table: 'initiatives(archive)', id: r.id, error: e instanceof Error ? e.message : String(e) })
      }
    }
    counts.archive = n

    // 3. Updates
    n = 0
    for (const r of updates) {
      if (!r.id || !r.initiativeId) continue
      try {
        await rawInsert('updates', {
          id: updateIds.get(r.id),
          initiative_id: initiativeIds.get(r.initiativeId),
          user_email: r.userEmail || '',
          user_name: r.userName || '',
          description: r.description || '',
          assigned_to: r.assignedTo || '',
          links: r.links || '',
          waiting_on: r.waitingOn || '',
          target_date: dt(r.targetDate),
          participants: r.participants || '',
          completed: bool(r.completed),
          created_at: dt(r.createdAt),
        })
        n++
      } catch (e) {
        errors.push({ table: 'updates', id: r.id, error: e instanceof Error ? e.message : String(e) })
      }
    }
    counts.updates = n

    // 4. UpdateComments
    n = 0
    for (const r of updateComments) {
      if (!r.id || !r.updateId) continue
      try {
        await rawInsert('update_comments', {
          id: randomUUID(),
          update_id: updateIds.get(r.updateId),
          user_email: r.userEmail || '',
          user_name: r.userName || '',
          content: r.content || '',
          created_at: dt(r.createdAt),
        })
        n++
      } catch (e) {
        errors.push({ table: 'update_comments', id: r.id, error: e instanceof Error ? e.message : String(e) })
      }
    }
    counts.updateComments = n

    // 5. InitiativeNotes
    n = 0
    for (const r of initNotes) {
      if (!r.id || !r.initiativeId) continue
      try {
        await rawInsert('initiative_notes', {
          id: randomUUID(),
          initiative_id: initiativeIds.get(r.initiativeId),
          user_email: r.userEmail || '',
          user_name: r.userName || '',
          content: r.content || '',
          created_at: dt(r.createdAt),
        })
        n++
      } catch (e) {
        errors.push({ table: 'initiative_notes', id: r.id, error: e instanceof Error ? e.message : String(e) })
      }
    }
    counts.initiativeNotes = n

    // 6. Community → community_posts (+ post_likes)
    n = 0
    let likesCount = 0
    for (const r of community) {
      if (!r.id) continue
      const newPostId = postIds.get(r.id)
      try {
        await rawInsert('community_posts', {
          id: newPostId,
          user_email: r.userEmail || '',
          user_name: r.userName || '',
          title: r.title || '',
          content: r.content || '',
          created_at: dt(r.createdAt),
          updated_at: dt(r.updatedAt),
        })
        n++

        if (r.likedBy) {
          const emails = r.likedBy.split(',').map(e => e.trim()).filter(Boolean)
          for (const email of emails) {
            try {
              await rawInsert('post_likes', { post_id: newPostId, user_email: email })
              likesCount++
            } catch {
              // ignore duplicate likes
            }
          }
        }
      } catch (e) {
        errors.push({ table: 'community_posts', id: r.id, error: e instanceof Error ? e.message : String(e) })
      }
    }
    counts.community = n
    counts.postLikes = likesCount

    // 7. Comments → community_comments
    n = 0
    for (const r of comments) {
      if (!r.id || !r.postId) continue
      try {
        await rawInsert('community_comments', {
          id: randomUUID(),
          post_id: postIds.get(r.postId),
          user_email: r.userEmail || '',
          user_name: r.userName || '',
          content: r.content || '',
          created_at: dt(r.createdAt),
        })
        n++
      } catch (e) {
        errors.push({ table: 'community_comments', id: r.id, error: e instanceof Error ? e.message : String(e) })
      }
    }
    counts.comments = n

    // 8. Personal → personal_notes
    n = 0
    for (const r of personal) {
      if (!r.id || !r.userEmail) continue
      try {
        await rawInsert('personal_notes', {
          id: noteIds.get(r.id),
          user_email: r.userEmail,
          title: r.title || '',
          content: r.content || '',
          created_at: dt(r.createdAt),
          updated_at: dt(r.updatedAt),
        })
        n++
      } catch (e) {
        errors.push({ table: 'personal_notes', id: r.id, error: e instanceof Error ? e.message : String(e) })
      }
    }
    counts.personal = n

    // 9. PersonalComments → personal_comments
    n = 0
    for (const r of personalComments) {
      if (!r.id || !r.noteId) continue
      try {
        await rawInsert('personal_comments', {
          id: randomUUID(),
          note_id: noteIds.get(r.noteId),
          content: r.content || '',
          created_at: dt(r.createdAt),
        })
        n++
      } catch (e) {
        errors.push({ table: 'personal_comments', id: r.id, error: e instanceof Error ? e.message : String(e) })
      }
    }
    counts.personalComments = n

    return NextResponse.json({ ok: true, counts, errors: errors.slice(0, 50), errorCount: errors.length })
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      errors: errors.slice(0, 50),
    }, { status: 500 })
  }
}
