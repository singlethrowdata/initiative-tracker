'use client'

import { useEffect, useState } from 'react'
import CumulativeFlowChart from '@/components/tabs/di/CumulativeFlowChart'

interface FlowData {
  avgLeadDays: number | null
  avgCycleDays: number | null
  doneCount: number
  throughputByWeek: { week: string; count: number }[]
}

const WIDTH = 800
const HEIGHT = 140
const BAR_GAP = 6

function ThroughputChart({ data }: { data: FlowData['throughputByWeek'] }) {
  if (!data.length) {
    return <p style={{ fontSize: '.75rem', color: 'var(--text-3)' }}>No completed initiatives in the trailing 12 weeks yet.</p>
  }
  const max = Math.max(1, ...data.map(d => d.count))
  const barWidth = WIDTH / data.length - BAR_GAP

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: '100%', height: 'auto', display: 'block' }} preserveAspectRatio="none">
      {data.map((d, i) => {
        const h = (d.count / max) * (HEIGHT - 20)
        const x = i * (barWidth + BAR_GAP)
        return (
          <g key={d.week}>
            <rect x={x} y={HEIGHT - h - 16} width={barWidth} height={h} fill="#4A7C54" opacity={0.85} />
            <text x={x + barWidth / 2} y={HEIGHT - h - 20} textAnchor="middle" fontSize="11" fill="var(--text-2, #333)">{d.count || ''}</text>
          </g>
        )
      })}
    </svg>
  )
}

// Lead Time / Cycle Time / Throughput — the flow metrics from the "Bigger but worth it"
// research (Kanban flow metrics). See docs/adr for why this reads from di_status_history
// rather than a separate tracking mechanism.
export default function FlowMetrics() {
  const [data, setData] = useState<FlowData | null>(null)

  useEffect(() => {
    fetch('/api/di-initiatives/flow-metrics').then(r => r.json()).then(setData)
  }, [])

  if (!data) return <div className="loading"><div className="spinner" /><div>Loading…</div></div>

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '.6rem', marginBottom: '1.25rem' }}>
        <div className="di-cap-card" style={{ padding: '.75rem 1rem' }}>
          <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>{data.avgLeadDays != null ? `${data.avgLeadDays.toFixed(1)}d` : '—'}</div>
          <div style={{ fontSize: '.65rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Avg Lead Time</div>
        </div>
        <div className="di-cap-card" style={{ padding: '.75rem 1rem' }}>
          <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>{data.avgCycleDays != null ? `${data.avgCycleDays.toFixed(1)}d` : '—'}</div>
          <div style={{ fontSize: '.65rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Avg Cycle Time</div>
        </div>
        <div className="di-cap-card" style={{ padding: '.75rem 1rem' }}>
          <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>{data.doneCount}</div>
          <div style={{ fontSize: '.65rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Total Done</div>
        </div>
      </div>

      <h4 style={{ fontSize: '.8rem', marginBottom: '.5rem' }}>Throughput — last 12 weeks</h4>
      <ThroughputChart data={data.throughputByWeek} />

      <h4 style={{ fontSize: '.8rem', margin: '1.5rem 0 .5rem' }}>Cumulative Flow — last 60 days</h4>
      <CumulativeFlowChart />
    </div>
  )
}
