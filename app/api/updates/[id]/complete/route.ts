import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { sql } from '@/lib/db'
import { getMemberName } from '@/lib/team'
import { sendTaskCompletedEmail } from '@/lib/email'

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: Request, { params }: Params) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const email = session.user.email.toLowerCase()

  const [update] = await sql`
    SELECT u.*, i.task_name AS initiative_task_name, i.participants AS initiative_participants
    FROM updates u
    LEFT JOIN initiatives i ON i.id = u.initiative_id
    WHERE u.id = ${id}
  `
  if (!update) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await sql`UPDATE updates SET completed = true WHERE id = ${id}`

  const openUpdates = await sql`
    SELECT waiting_on FROM updates
    WHERE initiative_id = ${update.initiative_id}
      AND completed = false
      AND waiting_on IS NOT NULL
      AND waiting_on != ''
    LIMIT 1
  `
  const mostRecent = (openUpdates[0]?.waiting_on ?? '') as string
  await sql`
    UPDATE initiatives SET waiting_on = ${mostRecent}, updated_at = ${new Date().toISOString()}
    WHERE id = ${update.initiative_id}
  `

  const completedByName = await getMemberName(email)
  const initiativeName = (update.initiative_task_name ?? '') as string
  const description = (update.description ?? '') as string

  const participantEmails = ((update.participants ?? '') as string)
    .split(',')
    .map((s: string) => s.trim().toLowerCase())
    .filter(Boolean)

  for (const memberEmail of participantEmails) {
    if (memberEmail !== email) {
      await sendTaskCompletedEmail(memberEmail, initiativeName, description, completedByName)
    }
  }

  return NextResponse.json({ success: true })
}
