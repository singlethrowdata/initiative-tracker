import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { sendMentionEmail } from '@/lib/email'

export async function GET() {
  try {
    const session = await getSession()
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const apiKey = process.env.RESEND_API_KEY
    const from = process.env.RESEND_FROM

    if (!apiKey || apiKey === 'your_resend_api_key') {
      return NextResponse.json({ error: 'RESEND_API_KEY not set in Vercel environment variables' })
    }

    const result = await sendMentionEmail(
      'dward@singlethrow.com',
      'Darian Ward',
      'Email Test',
      'test',
      'Initiative Tracker',
      'This is a test email from the Single Throw Initiative Tracker to confirm Resend is working correctly.'
    )

    return NextResponse.json({ ...result, apiKeyPrefix: apiKey.slice(0, 8), from })
  } catch (e: any) {
    return NextResponse.json({ error: e.message, stack: e.stack?.slice(0, 500) })
  }
}
