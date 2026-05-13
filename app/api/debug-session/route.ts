import { NextResponse, NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { getToken } from 'next-auth/jwt'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })

  const s = session as { accessToken?: string; user: { email: string; name?: string } }
  return NextResponse.json({
    email: s.user.email,
    name: s.user.name,
    session: {
      hasAccessToken: !!s.accessToken,
      keys: Object.keys(session),
    },
    jwt: {
      keys: token ? Object.keys(token) : null,
      hasAccessToken: !!(token as { accessToken?: string })?.accessToken,
      hasRefreshToken: !!(token as { refreshToken?: string })?.refreshToken,
      accessTokenPreview: (token as { accessToken?: string })?.accessToken?.slice(0, 24) ?? null,
    },
  })
}
