import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { sql } from '@/lib/db'
import { ResolvedDiConfig, getDiConfig, isDiTeamMember } from '@/lib/di-config'
import { DiConfig } from '@/types'

function toResponse(config: ResolvedDiConfig): DiConfig {
  return {
    capacity_budget_weeks: config.capacityBudgetWeeks,
    wip_cap: config.wipCap,
    size_presets: config.sizePresets,
    team_emails: config.teamEmails,
  }
}

export async function GET() {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return NextResponse.json(toResponse(await getDiConfig()))
}

export async function PATCH(req: Request) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const email = session.user.email.toLowerCase()
  if (!(await isDiTeamMember(email))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const writes: Array<[string, unknown]> = []
  if (body.capacity_budget_weeks !== undefined) writes.push(['capacity_budget_weeks', body.capacity_budget_weeks])
  if (body.wip_cap !== undefined) writes.push(['wip_cap', body.wip_cap])
  if (body.size_presets !== undefined) writes.push(['size_presets', body.size_presets])
  if (body.team_emails !== undefined) writes.push(['team_emails', body.team_emails])

  await Promise.all(
    writes.map(([key, value]) =>
      sql`
        INSERT INTO di_config (key, value) VALUES (${key}, ${JSON.stringify(value)})
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `
    )
  )

  return NextResponse.json(toResponse(await getDiConfig()))
}
