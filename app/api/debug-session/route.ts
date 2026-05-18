import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { sql } from '@/lib/db'

export async function GET() {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = session.user.email.toLowerCase()
  const [row] = await sql`SELECT gmail_access_token FROM team_members WHERE email = ${email}`
  const token = row?.gmail_access_token as string | null

  return NextResponse.json({
    email,
    hasGmailToken: !!token,
    tokenPreview: token ? token.slice(0, 20) + '…' : null,
  })
}
