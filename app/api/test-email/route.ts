import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { send } from '@/lib/email'

export async function GET(req: Request) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const to = searchParams.get('to') ?? session.user.email

  const result = await send(
    to,
    'Initiative Tracker — test email',
    `<div style="font-family:Arial,sans-serif;padding:20px">
      <h2 style="color:#1A5276">Test email</h2>
      <p>If you got this, Gmail API is working.</p>
      <p style="color:#8899A6;font-size:11px">Sent from Initiative Tracker via Gmail API + domain-wide delegation.</p>
    </div>`,
    'Test email. If you got this, Gmail API is working.'
  )

  return NextResponse.json({ to, from: process.env.GMAIL_SEND_AS ?? 'noreply@singlethrow.com', ...result })
}
