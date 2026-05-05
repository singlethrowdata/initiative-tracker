'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function DenyForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [comment, setComment] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    setStatus('submitting')
    try {
      const res = await fetch(`/api/approval/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment }),
      })
      setStatus(res.ok ? 'done' : 'error')
    } catch {
      setStatus('error')
    }
  }

  if (!token) {
    return <p style={{ color: '#D94F4F' }}>Invalid denial link.</p>
  }

  if (status === 'done') {
    return (
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ color: '#D94F4F' }}>✗ Completion Denied</h2>
        <p>The requester has been notified with your feedback.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2 style={{ color: '#1A5276', marginBottom: 16 }}>Deny Completion Request</h2>
      <p style={{ color: '#4A6274', marginBottom: 12, fontSize: 14 }}>
        Please provide feedback explaining why this initiative is not ready to be marked complete.
      </p>
      <textarea
        value={comment}
        onChange={e => setComment(e.target.value)}
        required
        rows={5}
        placeholder="Enter your feedback..."
        style={{
          width: '100%',
          padding: '10px 12px',
          border: '1px solid #CBD5E0',
          borderRadius: 6,
          fontSize: 14,
          color: '#1B2A3B',
          resize: 'vertical',
          boxSizing: 'border-box',
        }}
      />
      <button
        type="submit"
        disabled={status === 'submitting'}
        style={{
          marginTop: 16,
          padding: '12px 28px',
          background: '#D94F4F',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        {status === 'submitting' ? 'Submitting…' : '✗ Submit Denial'}
      </button>
      {status === 'error' && (
        <p style={{ color: '#D94F4F', marginTop: 8 }}>Something went wrong. Please try again.</p>
      )}
    </form>
  )
}

export default function DenyPage() {
  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: 540, margin: '60px auto', padding: '0 24px' }}>
      <Suspense fallback={<p>Loading…</p>}>
        <DenyForm />
      </Suspense>
    </div>
  )
}
