'use client'

import { useSession, signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { InitialData } from '@/types'
import TrackerTab from '@/components/tabs/TrackerTab'
import ArchiveTab from '@/components/tabs/ArchiveTab'
import CommunityTab from '@/components/tabs/CommunityTab'
import PersonalTab from '@/components/tabs/PersonalTab'
import DIRoadmapTab from '@/components/tabs/DIRoadmapTab'

type Tab = 'tracker' | 'archive' | 'community' | 'personal' | 'di-roadmap'

const TAB_LABEL: Record<Tab, string> = {
  tracker: 'Tracker', archive: 'Archive', community: 'Community', personal: 'Personal',
  'di-roadmap': 'D+I Roadmap',
}

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
            <img src="/ICONSTM_White.png" alt="Single Throw" className="logo-img" />
          </div>
          <div className="logo-text">
            Single Throw
            <small>Initiative Tracker</small>
          </div>
        </a>
        <div className="nav-right">
          <span style={{ fontSize: '.75rem', color: 'var(--text-3)', fontWeight: 600 }}>{user.name}</span>
          <a className="back-btn" href="https://singlethrow.com/internalhome">← Hub</a>
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
            {(['personal', 'community', 'tracker', 'archive', 'di-roadmap'] as Tab[]).map(t => (
              <button
                key={t}
                className={`tab-btn${tab === t ? ' active' : ''}`}
                onClick={() => setTab(t)}
              >
                {TAB_LABEL[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="main">
          {tab === 'tracker' && (
            <TrackerTab user={user} canDelete={canDelete} teamList={teamList} />
          )}
          {tab === 'archive' && (
            <ArchiveTab user={user} canDelete={canDelete} teamList={teamList} />
          )}
          {tab === 'community' && (
            <CommunityTab user={user} canDelete={canDelete} teamList={teamList} />
          )}
          {tab === 'personal' && (
            <PersonalTab user={user} />
          )}
          {tab === 'di-roadmap' && (
            <DIRoadmapTab user={user} canDelete={canDelete} teamList={teamList} />
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
