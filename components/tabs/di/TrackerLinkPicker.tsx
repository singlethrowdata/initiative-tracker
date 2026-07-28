'use client'

import { useEffect, useRef, useState } from 'react'
import { Initiative } from '@/types'

interface Props {
  value: string | null // tracker_initiative_id
  onChange: (id: string | null, taskName: string | null) => void
}

// Optional link to a Linked Initiative in the generic Tracker (see lexicon.md "Linked
// Initiative" / "Mirror Sync"). Data volume is small enough that a plain client-side
// filter over the full initiatives list is fine — no dedicated search endpoint needed.
export default function TrackerLinkPicker({ value, onChange }: Props) {
  const [all, setAll] = useState<Initiative[]>([])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/initiatives').then(r => r.json()).then(data => setAll(Array.isArray(data) ? data : []))
  }, [])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const linked = all.find(i => i.id === value) ?? null
  const matches = query
    ? all.filter(i => i.task_name.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : all.slice(0, 8)

  if (linked && !open) {
    return (
      <div className="ut-part-chip" style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem' }}>
        <span>{linked.task_name}</span>
        <button type="button" className="icon-btn" style={{ width: 20, height: 20 }} onClick={() => onChange(null, null)}>×</button>
      </div>
    )
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        type="text"
        placeholder="Search Tracker initiatives to link (optional)…"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
      />
      {open && matches.length > 0 && (
        <div className="participant-select-dropdown" style={{ display: 'block' }}>
          {matches.map(i => (
            <div
              key={i.id}
              className="participant-select-option"
              onClick={() => { onChange(i.id, i.task_name); setQuery(''); setOpen(false) }}
            >
              {i.task_name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
