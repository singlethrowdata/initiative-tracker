import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSession } from '@/lib/session'
import { sql } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Params) {
  const session = await getSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 503 })
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  try {
  const { id } = await params
  const body = await req.json()
  let transcript: string = body.transcript ?? ''

  if (body.docUrl) {
    const docMatch = (body.docUrl as string).match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/)
    if (!docMatch) {
      return NextResponse.json({ error: 'Invalid Google Doc URL. Make sure you paste the full document link.' }, { status: 400 })
    }
    const docId = docMatch[1]
    const exportRes = await fetch(`https://docs.google.com/document/d/${docId}/export?format=txt`, { redirect: 'follow' })
    if (!exportRes.ok || exportRes.url.includes('accounts.google.com')) {
      return NextResponse.json({ error: 'Could not access this document. Make sure it is set to "Anyone with the link can view".' }, { status: 400 })
    }
    transcript = await exportRes.text()
  }

  if (!transcript?.trim()) {
    return NextResponse.json({ error: 'No content found. Paste notes or check the document link.' }, { status: 400 })
  }

  const [initiative] = await sql`SELECT task_name, description, status FROM initiatives WHERE id = ${id}`
  if (!initiative) return NextResponse.json({ error: 'Initiative not found' }, { status: 404 })

  const existingMilestones = await sql`
    SELECT description FROM updates WHERE initiative_id = ${id} AND completed = false ORDER BY created_at DESC LIMIT 20
  `

  const existingList = existingMilestones.length > 0
    ? existingMilestones.map((m) => `- ${(m as { description: string }).description}`).join('\n')
    : 'None'

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    tools: [{
      name: 'extract_recommendations',
      description: 'Extract recommended next steps from meeting notes for a project initiative',
      input_schema: {
        type: 'object' as const,
        properties: {
          recommendations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['milestone', 'note'],
                  description: 'milestone = an actionable task to be tracked; note = information or context to capture',
                },
                description: {
                  type: 'string',
                  description: 'For milestones: clear action item description. For notes: the information to capture.',
                },
                assigned_to: {
                  type: 'string',
                  description: 'For milestones: person responsible, if mentioned. Leave empty if unclear.',
                },
                target_date: {
                  type: 'string',
                  description: 'For milestones: target date in YYYY-MM-DD format if mentioned, otherwise empty string.',
                },
              },
              required: ['type', 'description'],
            },
          },
        },
        required: ['recommendations'],
      },
    }],
    tool_choice: { type: 'tool', name: 'extract_recommendations' },
    messages: [{
      role: 'user',
      content: `You are analyzing meeting notes for a project initiative. Extract recommended next steps.

INITIATIVE: ${initiative.task_name}
STATUS: ${initiative.status}
DESCRIPTION: ${initiative.description || 'No description provided'}

EXISTING OPEN MILESTONES (do not duplicate these):
${existingList}

MEETING NOTES / TRANSCRIPT:
${transcript}

Extract:
1. Action items → type "milestone" (tasks someone needs to do)
2. Key decisions or information worth capturing → type "note"

Be specific and actionable. Skip anything already covered by the existing milestones. Return only genuinely useful items — quality over quantity.`,
    }],
  })

  const toolUse = response.content.find(b => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    return NextResponse.json({ error: 'Failed to extract recommendations' }, { status: 500 })
  }

  const { recommendations } = toolUse.input as { recommendations: Array<{
    type: 'milestone' | 'note'
    description: string
    assigned_to?: string
    target_date?: string
  }> }

  const withIds = recommendations.map((r, i) => ({
    id: `rec-${Date.now()}-${i}`,
    type: r.type,
    description: r.description,
    assigned_to: r.assigned_to ?? '',
    target_date: r.target_date ?? '',
    approved: true,
  }))

  return NextResponse.json({ recommendations: withIds })
  } catch (err) {
    console.error('Meeting analysis failed:', err)
    const raw = err instanceof Error ? err.message : ''
    if (/credit balance is too low|insufficient.*credit|billing/i.test(raw)) {
      return NextResponse.json(
        { error: 'Not enough Anthropic credits to analyze meeting notes. Add credits to the Anthropic account to re-enable this feature.' },
        { status: 402 },
      )
    }
    return NextResponse.json({ error: raw || 'Analysis failed. Please try again.' }, { status: 500 })
  }
}
