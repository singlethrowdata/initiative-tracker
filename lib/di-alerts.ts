// No existing code in this repo posts to CHAT_WEBHOOK_URL yet — this is a new
// convention. {"text": "..."} is the minimal payload both Slack incoming webhooks and
// Google Chat webhooks accept, but verify against the real webhook before relying on
// this in production (see Verification in the plan this was built from).
export async function postToChat(message: string): Promise<void> {
  const url = process.env.CHAT_WEBHOOK_URL
  if (!url) return

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: message }),
  })
  if (!res.ok) {
    console.error(`postToChat failed: ${res.status} ${await res.text()}`)
  }
}
