import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.RESEND_FROM ?? 'noreply@singlethrow.com'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

const header = (title: string) =>
  `<div style="background:linear-gradient(135deg,#1A5276,#2980B9,#6B8F71);padding:18px 22px;border-radius:10px 10px 0 0">
    <h2 style="color:#fff;margin:0;font-size:15px">${title}</h2>
  </div>`

const card = (body: string) =>
  `<div style="font-family:Arial,sans-serif;max-width:540px;margin:0 auto">
    <div style="background:#fff;padding:20px;border:1px solid #ddd;border-top:none;border-radius:0 0 10px 10px">${body}</div>
  </div>`

const footer = `<p style="color:#8899A6;font-size:11px;margin:10px 0 0">Single Throw Initiative Tracker</p>`

async function send(to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await resend.emails.send({ from: FROM, to, subject, html })
    if (error) {
      console.error('Resend error:', error)
      return { ok: false, error: error.message }
    }
    return { ok: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Resend threw:', msg)
    return { ok: false, error: msg }
  }
}

export async function sendMentionEmail(
  toEmail: string, toName: string, contextTitle: string,
  contextType: string, authorName: string, bodyText: string
) {
  const html = header('Single Throw — Initiative Tracker') +
    card(`<p style="color:#1B2A3B;font-size:13px;margin:0 0 6px"><strong>${authorName}</strong> mentioned you in a <strong>${contextType}</strong>:</p>
      <p style="color:#1A5276;font-size:15px;font-weight:700;margin:0 0 12px">${contextTitle}</p>
      <div style="background:#F4F6F8;border-radius:8px;padding:14px;margin:0 0 16px;color:#4A6274;font-size:13px;line-height:1.6">${bodyText}</div>
      ${footer}`)
  await send(toEmail, `${authorName} mentioned you in ${contextType}: ${contextTitle}`, html)
}

export async function sendWaitingOnEmail(
  toEmail: string, toName: string, initiativeName: string,
  requestedByName: string, updateDescription?: string
) {
  const actionBlock = updateDescription
    ? `<div style="background:#F4F6F8;border-radius:8px;padding:14px;margin:0 0 12px;color:#4A6274;font-size:13px;line-height:1.6">
        <strong style="color:#1A5276;font-size:11px;text-transform:uppercase;letter-spacing:.5px">Action Required:</strong>
        <div style="margin-top:8px;padding:10px 12px;background:#fff;border-left:3px solid #2980B9;border-radius:4px;font-size:13px;color:#1B2A3B">${updateDescription}</div>
       </div>` : ''

  const html = header('Single Throw — Initiative Tracker') +
    card(`<p style="color:#1B2A3B;font-size:13px;margin:0 0 6px"><strong>${requestedByName}</strong> is <strong>waiting on you</strong> for:</p>
      <p style="color:#1A5276;font-size:15px;font-weight:700;margin:0 0 12px">${initiativeName}</p>
      ${actionBlock}
      <div style="background:#FFF3E0;border-left:4px solid #F5A623;border-radius:4px;padding:14px;margin:0 0 16px;color:#4A6274;font-size:13px;line-height:1.6">
        This initiative is blocked until your input or action is received.
      </div>${footer}`)
  await send(toEmail, `Action needed — ${requestedByName} is waiting on you: ${initiativeName}`, html)
}

export async function sendWaitingOnReminderEmail(
  toEmail: string, toName: string, initiativeName: string,
  daysPending: number, requestedByName: string, pendingActions: string[]
) {
  const actionsBlock = pendingActions.length
    ? `<div style="background:#F4F6F8;border-radius:8px;padding:14px;margin:0 0 12px;color:#4A6274;font-size:13px;line-height:1.6">
        <strong style="color:#1A5276;font-size:11px;text-transform:uppercase;letter-spacing:.5px">Open Action Items:</strong>
        ${pendingActions.map(a => `<div style="margin-top:8px;padding:10px 12px;background:#fff;border-left:3px solid #D4920A;border-radius:4px;font-size:13px;color:#1B2A3B">${a}</div>`).join('')}
       </div>` : ''

  const html = `<div style="font-family:Arial,sans-serif;max-width:540px;margin:0 auto">
    <div style="background:linear-gradient(135deg,#D4920A,#F5A623);padding:18px 22px;border-radius:10px 10px 0 0">
      <h2 style="color:#fff;margin:0;font-size:15px">Reminder — Still Waiting On You</h2>
    </div>
    <div style="background:#fff;padding:20px;border:1px solid #ddd;border-top:none;border-radius:0 0 10px 10px">
      <p style="color:#1B2A3B;font-size:13px;margin:0 0 6px">Reminder: <strong>${requestedByName}</strong> is still waiting on you for:</p>
      <p style="color:#1A5276;font-size:15px;font-weight:700;margin:0 0 12px">${initiativeName}</p>
      ${actionsBlock}
      <div style="background:#FFF3E0;border-left:4px solid #D4920A;border-radius:4px;padding:14px;margin:0 0 16px;color:#4A6274;font-size:13px;line-height:1.6">
        <strong>${daysPending} days</strong> since assigned. Please provide an update.
      </div>
      <p style="color:#8899A6;font-size:11px;margin:0">Weekly reminder until resolved.</p>
    </div>
  </div>`
  await send(toEmail, `Reminder (${daysPending}d): Waiting — ${initiativeName}`, html)
}

export async function sendApprovalRequestEmail(
  initiativeId: string, taskName: string, token: string,
  participants: string, department: string, requesterName: string,
  requesterEmail: string, finalSummary?: string, sopLink?: string, toolLink?: string,
  description?: string, startDate?: string, endDate?: string
) {
  const approveUrl = `${APP_URL}/api/approval/${token}?action=approve`
  const denyUrl = `${APP_URL}/api/approval/${token}?action=deny`
  const initiativeUrl = `${APP_URL}?tab=tracker&id=${initiativeId}`

  const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

  let linksHtml = ''
  if (sopLink?.trim()) linksHtml += `<a href="${sopLink}" style="display:inline-block;margin:4px 8px 4px 0;padding:8px 16px;background:#1A5276;color:#fff;border-radius:6px;text-decoration:none;font-size:13px;font-weight:700">View SOP</a>`
  if (toolLink?.trim()) linksHtml += `<a href="${toolLink}" style="display:inline-block;margin:4px 8px 4px 0;padding:8px 16px;background:#2980B9;color:#fff;border-radius:6px;text-decoration:none;font-size:13px;font-weight:700">View Tool</a>`
  linksHtml += `<a href="${initiativeUrl}" style="display:inline-block;margin:4px 8px 4px 0;padding:8px 16px;background:#6B8F71;color:#fff;border-radius:6px;text-decoration:none;font-size:13px;font-weight:700">View Initiative</a>`

  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
    <div style="background:linear-gradient(135deg,#1A5276,#2980B9,#6B8F71);padding:18px 22px;border-radius:10px 10px 0 0">
      <h2 style="color:#fff;margin:0;font-size:16px">Initiative Completion — Approval Required</h2>
      <p style="color:rgba(255,255,255,0.8);font-size:12px;margin:4px 0 0">Single Throw Initiative Tracker</p>
    </div>
    <div style="background:#fff;padding:24px;border:1px solid #ddd;border-top:none;border-radius:0 0 10px 10px">
      <p style="color:#1B2A3B;font-size:13px;margin:0 0 16px"><strong>${requesterName}</strong> is requesting approval to mark the following initiative as complete${department ? ` (${department})` : ''}:</p>
      <div style="background:#F4F6F8;border-radius:10px;padding:18px;margin:0 0 18px">
        <div style="font-size:18px;font-weight:800;color:#1A5276;margin-bottom:10px">${taskName}</div>
        ${description ? `<div style="font-size:13px;color:#4A6274;line-height:1.7;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #DDE3EA">${description}</div>` : ''}
        <div style="margin-bottom:${participants || finalSummary ? '12px' : '0'}">
          <div style="display:inline-block;margin-right:32px">
            <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#8899A6;margin-bottom:2px">Start Date</div>
            <div style="font-size:13px;font-weight:700;color:#1B2A3B">${fmtDate(startDate)}</div>
          </div>
          <div style="display:inline-block">
            <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#8899A6;margin-bottom:2px">Target End</div>
            <div style="font-size:13px;font-weight:700;color:#1B2A3B">${fmtDate(endDate)}</div>
          </div>
        </div>
        ${participants ? `<div style="font-size:12px;color:#4A6274;margin-bottom:${finalSummary ? '12px' : '0'}"><strong>Participants:</strong> ${participants}</div>` : ''}
        ${finalSummary ? `<div style="margin-top:4px;padding:12px;background:#fff;border-left:3px solid #2980B9;border-radius:4px"><div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#1A5276;margin-bottom:4px">Completion Summary</div><div style="font-size:13px;color:#1B2A3B;line-height:1.7">${finalSummary}</div></div>` : ''}
      </div>
      <div style="margin-bottom:20px">${linksHtml}</div>
      <div style="background:#F0F4F8;border-radius:10px;padding:16px 20px;text-align:center">
        <p style="font-size:13px;color:#1B2A3B;font-weight:700;margin:0 0 14px">Please review and respond:</p>
        <a href="${approveUrl}" style="display:inline-block;margin:0 8px;padding:13px 32px;background:#6B8F71;color:#fff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:800">✓ Approve</a>
        <a href="${denyUrl}" style="display:inline-block;margin:0 8px;padding:13px 32px;background:#D94F4F;color:#fff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:800">✗ Deny</a>
      </div>
      <p style="color:#8899A6;font-size:11px;margin:10px 0 0;text-align:center">Clicking Deny will open a page where you can leave a comment.</p>
    </div>
  </div>`

  const recipients = ['nstryker@singlethrow.com', 'tech@singlethrow.com']
  const results = []
  for (const recipient of recipients) {
    const r = await send(recipient, `Approval Required — Complete Initiative: ${taskName}`, html)
    results.push({ recipient, ...r })
    if (!r.ok) console.error('Approval email failed for', recipient, r.error)
  }
  return results
}

export async function sendApprovalDecisionEmail(
  toEmail: string, taskName: string, decision: 'approved' | 'denied', comment?: string
) {
  const isApproved = decision === 'approved'
  const color = isApproved ? '#6B8F71' : '#D94F4F'
  const statusWord = isApproved ? 'Approved' : 'Denied'
  const headlineMsg = isApproved
    ? 'This initiative has been <strong>approved</strong> for completion.'
    : 'This completion request has been <strong>denied</strong>. Please review the feedback below.'
  const commentHtml = (!isApproved && comment)
    ? `<div style="background:#FFF0F0;border-left:3px solid #D94F4F;border-radius:6px;padding:12px 14px;margin:12px 0;font-size:13px;color:#1B2A3B;line-height:1.6"><strong>Feedback:</strong><br>${comment}</div>`
    : ''

  const html = `<div style="font-family:Arial,sans-serif;max-width:540px;margin:0 auto">
    <div style="background:linear-gradient(135deg,${color},${color}CC);padding:18px 22px;border-radius:10px 10px 0 0">
      <h2 style="color:#fff;margin:0;font-size:15px">${isApproved ? '✓' : '✗'} Initiative ${statusWord}: ${taskName}</h2>
    </div>
    <div style="background:#fff;padding:20px;border:1px solid #ddd;border-top:none;border-radius:0 0 10px 10px">
      <p style="color:#1B2A3B;font-size:13px;margin:0 0 10px">${headlineMsg}</p>
      ${commentHtml}${footer}
    </div>
  </div>`

  await send(toEmail, `${statusWord} — Initiative Completion: ${taskName}`, html)
}

export async function sendCommunityMilestoneEmail(
  toEmail: string, toName: string, postTitle: string, postContent: string
) {
  const html = header('Your idea has reached 10 upvotes!') +
    card(`<p style="color:#1B2A3B;font-size:13px;margin:0 0 8px">Hi <strong>${toName}</strong>,</p>
      <p style="color:#4A6274;font-size:13px;line-height:1.6;margin:0 0 12px">Your community idea has received 10 upvotes from the team — a great signal that this is worth moving forward!</p>
      <div style="background:#F4F6F8;border-radius:8px;padding:14px;margin:0 0 16px">
        <div style="font-size:.6rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#1A5276;margin-bottom:6px">Your Idea</div>
        <div style="font-size:14px;font-weight:700;color:#1B2A3B;margin-bottom:4px">${postTitle}</div>
        <div style="font-size:12px;color:#4A6274;line-height:1.6">${postContent}</div>
      </div>
      <p style="color:#4A6274;font-size:13px;line-height:1.6;margin:0 0 12px">When you're ready to move forward, please add this to the <strong>Initiative Tracker</strong> so it can be properly scoped, assigned, and tracked.</p>
      ${footer}`)
  await send(toEmail, `Your idea hit 10 upvotes — time to add it to the Tracker: ${postTitle}`, html)
}

export async function sendTaskCompletedEmail(
  toEmail: string, taskName: string, description: string, completedBy: string
) {
  const html = `<div style="font-family:Arial,sans-serif;max-width:540px;margin:0 auto">
    <div style="background:linear-gradient(135deg,#6B8F71,#82A888);padding:18px 22px;border-radius:10px 10px 0 0">
      <h2 style="color:#fff;margin:0;font-size:15px">Task Completed ✓</h2>
    </div>
    <div style="background:#fff;padding:20px;border:1px solid #ddd;border-top:none;border-radius:0 0 10px 10px">
      <p style="color:#1B2A3B;font-size:13px;margin:0 0 6px"><strong>${completedBy}</strong> marked a task as done:</p>
      <p style="color:#1A5276;font-size:15px;font-weight:700;margin:0 0 6px">${taskName}</p>
      <div style="background:#F4F6F8;border-radius:8px;padding:14px;margin:0 0 16px;color:#4A6274;font-size:13px;line-height:1.6">${description}</div>
      ${footer}
    </div>
  </div>`
  await send(toEmail, `Task completed: ${taskName}`, html)
}

export async function sendNewCommunityCommentEmail(
  authorName: string,
  authorEmail: string,
  postTitle: string,
  commentContent: string,
  recipients: { email: string; display_name: string }[]
) {
  const communityUrl = `${APP_URL}?tab=community`
  const html = header('New Comment on Community Post') +
    card(`<p style="color:#1B2A3B;font-size:13px;margin:0 0 6px"><strong>${authorName}</strong> commented on a Community post:</p>
      <div style="background:#F4F6F8;border-radius:8px;padding:14px;margin:0 0 16px">
        <div style="font-size:13px;font-weight:700;color:#1A5276;margin-bottom:8px">${postTitle}</div>
        <div style="font-size:13px;color:#4A6274;line-height:1.6;border-left:3px solid #2980B9;padding-left:10px">${commentContent}</div>
      </div>
      <a href="${communityUrl}" style="display:inline-block;padding:10px 22px;background:#1A5276;color:#fff;border-radius:6px;text-decoration:none;font-size:13px;font-weight:700">View on Community Board</a>
      ${footer}`)

  for (const r of recipients) {
    if (r.email === authorEmail) continue
    await send(r.email, `${authorName} commented on: ${postTitle}`, html)
  }
}

export async function sendNewCommunityPostEmail(
  authorName: string,
  authorEmail: string,
  postTitle: string,
  postContent: string,
  recipients: { email: string; display_name: string }[]
) {
  const communityUrl = `${APP_URL}?tab=community`
  const html = header('New Community Post') +
    card(`<p style="color:#1B2A3B;font-size:13px;margin:0 0 6px"><strong>${authorName}</strong> shared a new idea on the Community board:</p>
      <div style="background:#F4F6F8;border-radius:8px;padding:14px;margin:0 0 16px">
        <div style="font-size:15px;font-weight:700;color:#1A5276;margin-bottom:6px">${postTitle}</div>
        <div style="font-size:13px;color:#4A6274;line-height:1.6">${postContent}</div>
      </div>
      <a href="${communityUrl}" style="display:inline-block;padding:10px 22px;background:#1A5276;color:#fff;border-radius:6px;text-decoration:none;font-size:13px;font-weight:700">View on Community Board</a>
      ${footer}`)

  for (const r of recipients) {
    if (r.email === authorEmail) continue
    await send(r.email, `${authorName} posted on Community: ${postTitle}`, html)
  }
}
