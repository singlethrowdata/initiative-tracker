import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { Resend } from 'resend'

export async function GET() {
  try {
    const session = await getSession()
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const apiKey = process.env.RESEND_API_KEY
    const from = process.env.RESEND_FROM ?? 'noreply@singlethrow.com'

    if (!apiKey || apiKey === 'your_resend_api_key') {
      return NextResponse.json({ error: 'RESEND_API_KEY not set in Vercel environment variables' })
    }

    const resend = new Resend(apiKey)
    const { data, error } = await resend.emails.send({
      from,
      to: 'dward@singlethrow.com',
      subject: 'ST Initiative Tracker — Email Test',
      html: '<p>This is a test email from the Single Throw Initiative Tracker.</p>',
    })

    return NextResponse.json({ data, error, from, apiKeyPrefix: apiKey.slice(0, 8) })
  } catch (e: any) {
    return NextResponse.json({ error: e.message })
  }
}
