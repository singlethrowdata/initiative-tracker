'use client'

import { signIn } from 'next-auth/react'

export default function LoginPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', fontFamily: 'var(--font)' }}>
      <div className="bg-mesh">
        <div className="orb orb1" /><div className="orb orb2" /><div className="orb orb3" />
      </div>
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '2rem' }}>
        <div className="logo-icon" style={{ width: 64, height: 64, margin: '0 auto 1.5rem', borderRadius: 16 }}>
          <svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
        </div>
        <div className="logo-text" style={{ fontSize: '1.1rem', marginBottom: '.25rem' }}>
          Single Throw
          <small>Initiative Tracker</small>
        </div>
        <p style={{ color: 'var(--text-3)', fontSize: '.85rem', margin: '1.5rem 0 2rem', lineHeight: 1.6 }}>
          Sign in with your @singlethrow.com account to continue.
        </p>
        <button
          onClick={() => signIn('google', { callbackUrl: '/' })}
          className="btn btn-grad"
          style={{ fontSize: '.9rem', padding: '.85rem 2rem' }}
        >
          <svg viewBox="0 0 24 24" style={{ width: 18, height: 18 }}>
            <path fill="#fff" d="M12 11h8.533C20.84 14.843 17.493 18 12 18c-3.314 0-6-2.686-6-6s2.686-6 6-6c1.56 0 2.98.594 4.05 1.567l2.83-2.83C17.193 3.024 14.74 2 12 2 6.477 2 2 6.477 2 12s4.477 10 10 10c8.837 0 11-7.637 11-10 0-.68-.068-1.35-.2-2H12v1z" />
          </svg>
          Sign in with Google
        </button>
      </div>
    </div>
  )
}
