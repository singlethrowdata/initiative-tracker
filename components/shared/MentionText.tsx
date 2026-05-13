import React from 'react'

// Renders text with @mentions wrapped in blue .at-tag spans
export default function MentionText({ text }: { text: string }) {
  if (!text) return null
  const re = /@(everyone\b|\w+(?:\s+\w+)?)/gi
  const parts: React.ReactNode[] = []
  let lastIdx = 0
  let match: RegExpExecArray | null
  let key = 0
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.slice(lastIdx, match.index))
    }
    parts.push(<span key={key++} className="at-tag">{match[0]}</span>)
    lastIdx = match.index + match[0].length
  }
  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx))
  }
  return <>{parts}</>
}
