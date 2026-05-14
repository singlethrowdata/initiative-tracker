import { AuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { sql } from './db'

const ALLOWED_DOMAIN = 'singlethrow.com'

export const authOptions: AuthOptions = {
  session: { strategy: 'jwt' },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/gmail.send',
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ profile }) {
      const email = profile?.email ?? ''
      if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) return false

      const name = profile?.name ?? email.split('@')[0]
      await sql`
        INSERT INTO team_members (email, display_name)
        VALUES (${email.toLowerCase()}, ${name})
        ON CONFLICT (email) DO NOTHING
      `
      return true
    },
    async session({ session, token }) {
      if (session.user?.email) {
        const [data] = await sql`
          SELECT display_name, role, status
          FROM team_members
          WHERE email = ${session.user.email.toLowerCase()}
        `
        if (data) {
          session.user.name = (data.display_name as string) ?? session.user.name
          // @ts-expect-error — extending session type
          session.user.role = data.role ?? 'Employee'
          // @ts-expect-error
          session.user.isAdmin = data.role === 'Admin'
          // @ts-expect-error
          session.user.isActive = data.status !== 'Inactive'
        }
      }
      // @ts-expect-error — expose Gmail token to server-side callers via getSession()
      session.accessToken = token.accessToken
      return session
    },
    async jwt({ token, profile, account }) {
      if (profile?.email) token.email = profile.email as string
      if (account) {
        // Diagnostic: record what we received from the OAuth provider on this sign-in
        // @ts-expect-error — debug field
        token._debugAccount = {
          provider: account.provider,
          type: account.type,
          keys: Object.keys(account),
          hasAccessToken: !!account.access_token,
          hasRefreshToken: !!account.refresh_token,
          scope: account.scope,
        }
        if (account.access_token) token.accessToken = account.access_token
        if (account.refresh_token) token.refreshToken = account.refresh_token
        if (account.expires_at) token.expiresAt = account.expires_at
      }
      return token
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
}
