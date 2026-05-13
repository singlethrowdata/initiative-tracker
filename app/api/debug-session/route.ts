import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

export async function GET() {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const s = session as { accessToken?: string; user: { email: string; name?: string } }
  return NextResponse.json({
    email: s.user.email,
    name: s.user.name,
    hasAccessToken: !!s.accessToken,
    accessTokenPreview: s.accessToken ? s.accessToken.slice(0, 20) + '...' : null,
    keys: Object.keys(session),
  })
}
