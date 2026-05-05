import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getActiveTeam, isAdmin } from '@/lib/team'

export async function GET() {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = session.user.email.toLowerCase()
  const [team, adminFlag] = await Promise.all([getActiveTeam(), isAdmin(email)])

  const member = team.find(m => m.email === email)
  const name = member?.display_name ?? session.user.name ?? email.split('@')[0]

  return NextResponse.json({
    user: { email, name },
    canDelete: adminFlag,
    teamList: team,
  })
}
