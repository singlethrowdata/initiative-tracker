export function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

export function fmt(dateStr: string): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function fmtRelative(dateStr: string): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return fmt(dateStr)
}

export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000)
}

export function statusClass(status: string): string {
  const s = (status ?? '').toLowerCase().trim()
  if (s === 'planning') return 's-planning'
  if (s === 'in progress') return 's-active'
  if (s === 'not started') return 's-pending'
  if (s === 'blocked') return 's-blocked'
  if (s === 'complete') return 's-complete'
  if (s === 'completed' || s === 'approved') return 's-approved'
  if (s.includes('await') || s.includes('approv')) return 's-await'
  return 's-other'
}

// D+I Roadmap has its own disjoint status vocabulary (Backlog/In Queue/Design/Build/QA/
// Awaiting Approval/Deploy/Done/Blocked/Paused) so it gets its own color mapping rather
// than overloading statusClass(). Used for both the status pill and the timeline bar.
export function diStatusClass(status: string): string {
  const s = (status ?? '').toLowerCase().trim()
  if (s === 'backlog') return 'di-backlog'
  if (s === 'in queue') return 'di-queue'
  if (s === 'design') return 'di-design'
  if (s === 'build') return 'di-build'
  if (s === 'qa') return 'di-qa'
  if (s === 'awaiting approval') return 'di-approval'
  if (s === 'deploy') return 'di-deploy'
  if (s === 'done') return 'di-done'
  if (s === 'blocked') return 'di-blocked'
  if (s === 'paused') return 'di-paused'
  return 'di-other'
}

// Solid-fill variant for StageTimelineBar segments (diStatusClass above is the light
// pill-tint variant used for the status badge).
export function diSegClass(status: string): string {
  const s = (status ?? '').toLowerCase().trim()
  if (s === 'backlog') return 'di-seg-backlog'
  if (s === 'in queue') return 'di-seg-queue'
  if (s === 'design') return 'di-seg-design'
  if (s === 'build') return 'di-seg-build'
  if (s === 'qa') return 'di-seg-qa'
  if (s === 'awaiting approval') return 'di-seg-approval'
  if (s === 'deploy') return 'di-seg-deploy'
  if (s === 'done') return 'di-seg-done'
  if (s === 'blocked') return 'di-seg-blocked'
  if (s === 'paused') return 'di-seg-paused'
  return 'di-seg-other'
}

export function priorityClass(priority: string): string {
  if (priority === 'High') return 'p-high'
  if (priority === 'Medium') return 'p-med'
  return 'p-low'
}

export function daysClass(days: number, completed: boolean): string {
  if (completed) return 'days-badge days-done'
  if (days >= 0) return 'days-badge days-ok'
  if (days >= -3) return 'days-badge days-warn'
  return 'days-badge days-over'
}

export function parseLinks(links: string): string[] {
  return links.split(/[\n,]/).map(l => l.trim()).filter(Boolean)
}
