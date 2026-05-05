import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { sendApprovalRequestEmail } from '@/lib/email'
import { getMemberName } from '@/lib/team'

// Vercel cron: daily — re-send approval emails for initiatives pending > 3 days
export async function GET(req: Request) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString()

  const initiatives = await sql`
    SELECT * FROM initiatives
    WHERE approval_status = 'pending'
      AND approval_requested_at < ${threeDaysAgo}
  `

  let sent = 0
  for (const initiative of initiatives) {
    if (!initiative.approval_token) continue
    const requesterName = await getMemberName(initiative.created_by as string)
    await sendApprovalRequestEmail(
      initiative.id as string,
      initiative.task_name as string,
      initiative.approval_token as string,
      (initiative.participants ?? '') as string,
      (initiative.department ?? '') as string,
      requesterName,
      initiative.created_by as string,
      initiative.completion_desc as string,
      initiative.sop_link as string,
      initiative.completion_links as string
    )
    sent++
  }

  return NextResponse.json({ sent })
}
