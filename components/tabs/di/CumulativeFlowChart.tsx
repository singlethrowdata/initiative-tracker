'use client'

import { useEffect, useState } from 'react'
import { STATUS_VALUES } from '@/lib/di-scheduling'

type DayRow = { date: string } & Record<string, number | string>

// Same palette as the .di-seg-* classes in globals.css / diSegClass() in lib/ui.ts —
// duplicated here as hex values because SVG <path fill> needs a literal color, not a
// class. Keep in sync if the palette ever changes.
const COLOR: Record<string, string> = {
  Backlog: '#AAB2B8', 'In Queue': '#5DADE2', Design: '#9B59B6', Build: '#1A5276',
  QA: '#21618C', 'Awaiting Approval': '#D4920A', Deploy: '#4A7C54', Done: '#6B8F71',
  Blocked: '#C0392B', Paused: '#999',
}

const WIDTH = 800
const HEIGHT = 220

// Hand-rolled stacked-area SVG — no charting library in this codebase (see
// StageTimelineBar for the same philosophy). Shows, per day, how many initiatives sat in
// each status — the classic "is a stage silently piling up" signal.
export default function CumulativeFlowChart() {
  const [data, setData] = useState<DayRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/di-initiatives/flow-history?days=60')
      .then(r => r.json())
      .then(rows => { setData(Array.isArray(rows) ? rows : []); setLoading(false) })
  }, [])

  if (loading) return <div className="loading"><div className="spinner" /><div>Loading…</div></div>
  if (!data.length) return null

  const maxTotal = Math.max(1, ...data.map(d => STATUS_VALUES.reduce((sum, s) => sum + (Number(d[s]) || 0), 0)))
  const xStep = WIDTH / (data.length - 1 || 1)
  const yScale = (v: number) => HEIGHT - (v / maxTotal) * HEIGHT

  const bands = STATUS_VALUES.map((status, idx) => {
    const below = STATUS_VALUES.slice(0, idx)
    const cumBelow = data.map(d => below.reduce((sum, s) => sum + (Number(d[s]) || 0), 0))
    const cumThrough = data.map((d, i) => cumBelow[i] + (Number(d[status]) || 0))

    const topPoints = cumThrough.map((v, i) => `${i * xStep},${yScale(v)}`)
    const bottomPoints = cumBelow.map((v, i) => `${i * xStep},${yScale(v)}`).reverse()
    const points = [...topPoints, ...bottomPoints].join(' ')

    return { status, points }
  })

  return (
    <div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: '100%', height: 'auto', display: 'block' }} preserveAspectRatio="none">
        {bands.map(b => (
          <polygon key={b.status} points={b.points} fill={COLOR[b.status]} opacity={0.85} />
        ))}
      </svg>
      <div className="di-timeline-legend" style={{ marginTop: '.6rem' }}>
        {STATUS_VALUES.map(s => (
          <span key={s} className="di-timeline-legend-item">
            <span className="d" style={{ background: COLOR[s] }} />
            {s}
          </span>
        ))}
      </div>
    </div>
  )
}
