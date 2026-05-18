import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { sql } from '@/lib/db'

export async function GET() {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = session.user.email.toLowerCase()
  const [row] = await sql`SELECT gmail_access_token FROM team_members WHERE email = ${email}`
  const stored = row?.gmail_access_token as string | null

  // Show first 30 chars — enough to distinguish a token (ya29...) from a debug JSON blob
  return NextResponse.json({
    email,
    hasGmailToken: !!stored,
    stored: stored ? stored.slice(0, 120) : null,
  })
}
