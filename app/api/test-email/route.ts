import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { sendMentionEmail } from '@/lib/email'

export async function GET() {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await sendMentionEmail(
    'dward@singlethrow.com',
    'Darian Ward',
    'Email Test',
    'test',
    'Initiative Tracker',
    'This is a test email from the Single Throw Initiative Tracker to confirm Resend is working correctly.'
  )

  return NextResponse.json(result)
}
