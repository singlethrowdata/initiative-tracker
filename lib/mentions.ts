import { getActiveTeam, getTeamByName } from './team'
import { sendMentionEmail } from './email'

interface Mention {
  type: 'person' | 'everyone'
  email?: string
  name?: string
}

export async function parseMentions(text: string): Promise<Mention[]> {
  const mentions: Mention[] = []
  const lower = text.toLowerCase()

  if (lower.includes('@everyone')) {
    return [{ type: 'everyone' }]
  }

  const team = await getActiveTeam()
  const nameList: { email: string; name: string; match: string }[] = []

  for (const member of team) {
    const name = member.display_name
    nameList.push({ email: member.email, name, match: name.toLowerCase() })
    const parts = name.split(' ')
    if (parts.length > 1) nameList.push({ email: member.email, name, match: parts[0].toLowerCase() })
    if (parts.length > 2) nameList.push({ email: member.email, name, match: (parts[0] + ' ' + parts[1]).toLowerCase() })
  }

  // Sort longest match first to avoid partial matches
  nameList.sort((a, b) => b.match.length - a.match.length)

  const found = new Set<string>()
  for (const entry of nameList) {
    const searchFor = '@' + entry.match
    let idx = lower.indexOf(searchFor)
    while (idx > -1) {
      const afterIdx = idx + searchFor.length
      const charAfter = afterIdx < lower.length ? lower[afterIdx] : ''
      const charBefore = idx > 0 ? lower[idx - 1] : ''
      const isWordEnd = charAfter === '' || /[\s.,!?;:\-)]/. test(charAfter)
      const isWordStart = idx === 0 || /\s/.test(charBefore)
      if (isWordEnd && isWordStart && !found.has(entry.email)) {
        mentions.push({ type: 'person', email: entry.email, name: entry.name })
        found.add(entry.email)
      }
      idx = lower.indexOf(searchFor, idx + 1)
    }
  }

  return mentions
}

export async function processAndNotifyMentions(
  text: string,
  contextTitle: string,
  contextType: string,
  authorName: string,
  authorEmail: string
) {
  if (!text) return
  const mentions = await parseMentions(text)
  if (!mentions.length) return

  const team = await getActiveTeam()

  for (const mention of mentions) {
    if (mention.type === 'everyone') {
      for (const member of team) {
        if (member.email !== authorEmail) {
          await sendMentionEmail(member.email, member.display_name, contextTitle, contextType, authorName, text)
        }
      }
    } else if (mention.email) {
      await sendMentionEmail(mention.email, mention.name!, contextTitle, contextType, authorName, text)
    }
  }
}
