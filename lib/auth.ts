import { AuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { sql } from './db'

const ALLOWED_DOMAIN = 'singlethrow.com'

export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
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
    async session({ session }) {
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
