import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { sql } from '@/lib/db'
import { isAdmin } from '@/lib/team'

export async function GET() {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await sql`SELECT key, value FROM di_config`
  const config = Object.fromEntries((rows as { key: string; value: string }[]).map(r => [r.key, r.value]))
  return NextResponse.json(config)
}

export async function PATCH(req: Request) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = session.user.email.toLowerCase()
  if (!(await isAdmin(email))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const entries = Object.entries(body).filter(([, v]) => typeof v === 'string')
  for (const [key, value] of entries) {
    await sql`
      INSERT INTO di_config (key, value) VALUES (${key}, ${value as string})
      ON CONFLICT (key) DO UPDATE SET value = ${value as string}
    `
  }

  const rows = await sql`SELECT key, value FROM di_config`
  const config = Object.fromEntries((rows as { key: string; value: string }[]).map(r => [r.key, r.value]))
  return NextResponse.json(config)
}
