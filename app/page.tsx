'use client'

import { useSession, signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { InitialData } from '@/types'
import TrackerTab from '@/components/tabs/TrackerTab'
import ArchiveTab from '@/components/tabs/ArchiveTab'
import CommunityTab from '@/components/tabs/CommunityTab'
import PersonalTab from '@/components/tabs/PersonalTab'

type Tab = 'tracker' | 'archive' | 'community' | 'personal'

export default function Home() {
  const { status } = useSession()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('personal')
  const [initData, setInitData] = useState<InitialData | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
  }, [status, router])

  useEffect(() => {
    if (status === 'authenticated') {
      fetch('/api/init').then(r => r.json()).then(setInitData)
    }
  }, [status])

  if (status === 'loading' || !initData) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="bg-mesh"><div className="orb orb1" /><div className="orb orb2" /><div className="orb orb3" /></div>
        <div className="loading" style={{ position: 'relative', zIndex: 1 }}>
          <div className="spinner" />
          <div>Loading…</div>
        </div>
      </div>
    )
  }

  if (status === 'unauthenticated') return null

  const { user, canDelete, teamList } = initData

  return (
    <div className="wrapper">
      <div className="bg-mesh">
        <div className="orb orb1" /><div className="orb orb2" /><div className="orb orb3" />
      </div>

      <nav>
        <a className="logo" href="/">
          <div className="logo-icon">
            <svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
          </div>
          <div className="logo-text">
            Single Throw
            <small>Initiative Tracker</small>
          </div>
        </a>
        <div className="nav-right">
          <a className="back-btn" href="https://singlethrow.com/internalhome">← Hub</a>
          <span style={{ fontSize: '.75rem', color: 'var(--text-3)', fontWeight: 600 }}>{user.name}</span>
          <button className="back-btn" onClick={() => signOut({ callbackUrl: '/login' })}>
            Sign out
          </button>
        </div>
      </nav>

      <div style={{ paddingTop: 64 }}>
        <div className="hero-bar">
          <h1>Where <span>ideas</span> become reality.</h1>
          <p>Your quick-capture notebook, the team's whiteboard, and the company's roadmap.</p>
          <div className="tab-bar">
            {(['personal', 'community', 'tracker', 'archive'] as Tab[]).map(t => (
              <button
                key={t}
                className={`tab-btn${tab === t ? ' active' : ''}`}
                onClick={() => setTab(t)}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="main">
          {tab === 'tracker' && (
            <TrackerTab user={user} canDelete={canDelete} teamList={teamList} />
          )}
          {tab === 'archive' && (
            <ArchiveTab user={user} canDelete={canDelete} />
          )}
          {tab === 'community' && (
            <CommunityTab user={user} canDelete={canDelete} teamList={teamList} />
          )}
          {tab === 'personal' && (
            <PersonalTab user={user} />
          )}
        </div>

        <footer>
          <div className="footer-t">Single Throw</div>
          <div className="footer-s">Initiative Tracker — Internal Use Only</div>
        </footer>
      </div>
    </div>
  )
}
