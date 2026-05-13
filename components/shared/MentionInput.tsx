'use client'

import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { TeamMember } from '@/types'

interface Props {
  value: string
  onChange: (v: string) => void
  onEnter?: () => void
  placeholder?: string
  teamList: TeamMember[]
  multiline?: boolean
  rows?: number
}

export default function MentionInput({
  value, onChange, onEnter, placeholder, teamList, multiline, rows = 3,
}: Props) {
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const [picker, setPicker] = useState<{ query: string; startIdx: number } | null>(null)
  const [highlight, setHighlight] = useState(0)

  // Filter team list by what was typed after @
  const matches = picker
    ? [
        ...(('everyone'.startsWith(picker.query.toLowerCase())) ? [{ email: '__everyone__', display_name: 'everyone' } as TeamMember] : []),
        ...teamList.filter(m =>
          m.display_name.toLowerCase().includes(picker.query.toLowerCase()) ||
          m.email.toLowerCase().includes(picker.query.toLowerCase())
        ).slice(0, 8),
      ]
    : []

  function handleChange(newValue: string, caret: number) {
    onChange(newValue)

    // Look back from caret to find a '@' that isn't preceded by a word char (i.e. start of mention)
    const before = newValue.slice(0, caret)
    const atMatch = before.match(/(?:^|\s)@([A-Za-z0-9 ]*)$/)
    if (atMatch) {
      const query = atMatch[1]
      const startIdx = caret - query.length - 1 // index of the '@'
      setPicker({ query, startIdx })
      setHighlight(0)
    } else {
      setPicker(null)
    }
  }

  function selectMention(member: TeamMember) {
    if (!picker || !ref.current) return
    const name = member.email === '__everyone__' ? 'everyone' : member.display_name
    const before = value.slice(0, picker.startIdx)
    const afterCaret = ref.current.selectionStart ?? value.length
    const after = value.slice(afterCaret)
    const inserted = `@${name} `
    const newValue = before + inserted + after
    onChange(newValue)
    setPicker(null)
    // Move caret to end of inserted mention
    requestAnimationFrame(() => {
      if (ref.current) {
        const newCaret = before.length + inserted.length
        ref.current.focus()
        ref.current.setSelectionRange(newCaret, newCaret)
      }
    })
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (picker && matches.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlight(h => (h + 1) % matches.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlight(h => (h - 1 + matches.length) % matches.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        selectMention(matches[highlight])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setPicker(null)
        return
      }
    }
    if (!picker && e.key === 'Enter' && !multiline && onEnter) {
      onEnter()
    }
  }

  const sharedProps = {
    value,
    placeholder,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      handleChange(e.target.value, e.target.selectionStart ?? e.target.value.length),
    onKeyDown: handleKeyDown,
  }

  return (
    <div style={{ position: 'relative' }}>
      {multiline ? (
        <textarea
          ref={ref as React.RefObject<HTMLTextAreaElement>}
          rows={rows}
          {...sharedProps}
        />
      ) : (
        <input
          ref={ref as React.RefObject<HTMLInputElement>}
          type="text"
          {...sharedProps}
        />
      )}
      {picker && matches.length > 0 && (
        <div className="mention-picker">
          {matches.map((m, i) => (
            <div
              key={m.email}
              className={`mention-opt${i === highlight ? ' active' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); selectMention(m) }}
            >
              <span className="mention-name">{m.email === '__everyone__' ? '@everyone' : m.display_name}</span>
              {m.email !== '__everyone__' && <span className="mention-email">{m.email}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
