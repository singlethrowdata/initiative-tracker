'use client'

import { useState, useRef, useEffect } from 'react'
import { TeamMember } from '@/types'

interface Props {
  teamList: TeamMember[]
  value: string
  onChange: (val: string) => void
}

export default function ParticipantSelect({ teamList, value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const selected = new Set(
    value.split(',').map(s => s.trim()).filter(Boolean)
  )

  function toggle(name: string) {
    const next = new Set(selected)
    next.has(name) ? next.delete(name) : next.add(name)
    onChange([...next].join(', '))
  }

  const filtered = teamList.filter(m =>
    m.display_name.toLowerCase().includes(query.trim().toLowerCase())
  )

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  const label = selected.size === 0
    ? 'Select participants…'
    : [...selected].join(', ')

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className="participant-select-btn"
        onClick={() => setOpen(o => !o)}
      >
        <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: selected.size === 0 ? 'var(--text-3)' : 'var(--text)' }}>
          {label}
        </span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, flexShrink: 0, color: 'var(--text-3)' }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="participant-select-dropdown">
          <div className="participant-select-search">
            <input
              type="text"
              autoFocus
              placeholder="Search participants…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          {filtered.length === 0 ? (
            <div className="participant-select-empty">No matches</div>
          ) : (
            filtered.map(m => (
              <label key={m.email} className="participant-select-option">
                <input
                  type="checkbox"
                  checked={selected.has(m.display_name)}
                  onChange={() => toggle(m.display_name)}
                />
                <span>{m.display_name}</span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  )
}
