'use client'

import { useState, useEffect } from 'react'
import { Initiative } from '@/types'

interface Props {
  postId: string
  postTitle: string
  onClose: () => void
  onLinked: (initiative: Initiative) => void
}

export default function LinkInitiativeModal({ postId, postTitle, onClose, onLinked }: Props) {
  const [initiatives, setInitiatives] = useState<Initiative[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [linkingId, setLinkingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/initiatives')
      .then(r => r.json())
      .then(data => {
        setInitiatives(Array.isArray(data) ? data : [])
        setLoading(false)
      })
  }, [])

  async function handleLink(initiative: Initiative) {
    setLinkingId(initiative.id)
    setError('')
    const res = await fetch(`/api/initiatives/${initiative.id}/community-links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: postId }),
    })
    if (!res.ok) {
      setError('Failed to link. Please try again.')
      setLinkingId(null)
      return
    }
    onLinked(initiative)
  }

  const q = search.trim().toLowerCase()
  const filtered = q
    ? initiatives.filter(i => i.task_name.toLowerCase().includes(q))
    : initiatives

  return (
    <div className="overlay show" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <h3>Attach to an Initiative</h3>
        <div className="modal-body">
          <p style={{ fontSize: '.82rem', color: 'var(--text-2)', marginBottom: '.75rem', lineHeight: 1.6 }}>
            Absorb <strong>“{postTitle}”</strong> into an existing initiative. It will appear in that initiative’s
            Community Ideas section, and this post will be marked resolved on the board.
          </p>
          <input
            type="text"
            placeholder="Search initiatives…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
            style={{ width: '100%', marginBottom: '.6rem' }}
          />
          {loading ? (
            <p style={{ color: 'var(--text-3)', fontSize: '.82rem', padding: '.5rem' }}>Loading initiatives…</p>
          ) : filtered.length === 0 ? (
            <p style={{ color: 'var(--text-3)', fontSize: '.82rem', padding: '.5rem' }}>
              {initiatives.length === 0 ? 'No active initiatives.' : 'No matching initiatives.'}
            </p>
          ) : (
            <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
              {filtered.map(i => (
                <button
                  key={i.id}
                  onClick={() => handleLink(i)}
                  disabled={linkingId === i.id}
                  style={{ textAlign: 'left', padding: '.6rem .7rem', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '.2rem' }}
                >
                  <span style={{ fontSize: '.84rem', fontWeight: 700, color: 'var(--text)' }}>{i.task_name}</span>
                  <span style={{ fontSize: '.68rem', color: 'var(--text-3)' }}>
                    {i.status}{i.department ? ` · ${i.department}` : ''}
                    {linkingId === i.id ? ' · Attaching…' : ''}
                  </span>
                </button>
              ))}
            </div>
          )}
          {error && <p style={{ color: 'var(--danger)', fontSize: '.8rem', marginTop: '.5rem' }}>{error}</p>}
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
