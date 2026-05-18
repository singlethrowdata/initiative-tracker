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
    async signIn({ profile, account }) {
      const email = (profile?.email ?? '').toLowerCase()
      if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) return false

      const name = profile?.name ?? email.split('@')[0]
      await sql`
        INSERT INTO team_members (email, display_name)
        VALUES (${email}, ${name})
        ON CONFLICT (email) DO NOTHING
      `

      // Persist the Gmail access token so email.ts can read it by sender email
      if (account?.access_token) {
        try {
          await sql`
            UPDATE team_members SET gmail_access_token = ${account.access_token} WHERE email = ${email}
          `
        } catch (e) {
          console.error('Failed to store gmail token:', e)
        }
      }

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
      return session
    },
    async jwt({ token, profile }) {
      if (profile?.email) token.email = profile.email as string
      return token
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
}
