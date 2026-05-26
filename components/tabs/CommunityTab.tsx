'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { CommunityPost, CommunityComment, TeamMember } from '@/types'
import { initials, fmtRelative } from '@/lib/ui'
import MentionInput from '@/components/shared/MentionInput'
import MentionText from '@/components/shared/MentionText'

interface Props {
  user: { email: string; name: string }
  canDelete: boolean
  teamList: TeamMember[]
}

export default function CommunityTab({ user, canDelete, teamList }: Props) {
  const [posts, setPosts] = useState<(CommunityPost & { community_comments: CommunityComment[] })[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [posting, setPosting] = useState(false)
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set())
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  const [concernOpen, setConcernOpen] = useState<Set<string>>(new Set())
  const [concernDrafts, setConcernDrafts] = useState<Record<string, string>>({})
  const [concernError, setConcernError] = useState<Set<string>>(new Set())
  const submittingComments = useRef<Set<string>>(new Set())
  const [submittingSet, setSubmittingSet] = useState<Set<string>>(new Set())
  const [transferredPosts, setTransferredPosts] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    const data = await fetch('/api/community').then(r => r.json())
    setPosts(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handlePost() {
    if (!title.trim()) return
    setPosting(true)
    const res = await fetch('/api/community', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content }),
    })
    const newPost = await res.json()
    setPosts(prev => [{ ...newPost, community_comments: [] }, ...prev])
    setTitle(''); setContent('')
    setPosting(false)
  }

  async function handleLike(postId: string) {
    const res = await fetch(`/api/community/${postId}/like`, { method: 'POST' })
    const { likes, liked } = await res.json()
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes, liked_by_user: liked } : p))
  }

  async function handleComment(postId: string) {
    const text = commentDrafts[postId]?.trim()
    if (!text || submittingComments.current.has(postId)) return
    submittingComments.current.add(postId)
    setSubmittingSet(new Set(submittingComments.current))
    try {
      const res = await fetch(`/api/community/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      })
      const comment = await res.json()
      setPosts(prev => prev.map(p =>
        p.id === postId ? { ...p, community_comments: [...(p.community_comments ?? []), comment] } : p
      ))
      setCommentDrafts(prev => ({ ...prev, [postId]: '' }))
    } finally {
      submittingComments.current.delete(postId)
      setSubmittingSet(new Set(submittingComments.current))
    }
  }

  async function handleConcern(postId: string) {
    const text = concernDrafts[postId]?.trim()
    if (!text) {
      setConcernError(prev => new Set(prev).add(postId))
      return
    }
    const res = await fetch(`/api/community/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text, is_concern: true }),
    })
    const comment = await res.json()
    setPosts(prev => prev.map(p =>
      p.id === postId ? { ...p, community_comments: [...(p.community_comments ?? []), comment] } : p
    ))
    setConcernDrafts(prev => ({ ...prev, [postId]: '' }))
    setConcernOpen(prev => { const n = new Set(prev); n.delete(postId); return n })
    setConcernError(prev => { const n = new Set(prev); n.delete(postId); return n })
    setExpandedComments(prev => new Set(prev).add(postId))
  }

  function handleExport() {
    const rows = [
      ['Title', 'Author', 'Date Posted', 'Content', 'Likes', 'Comments'],
      ...posts.map(p => [
        p.title,
        p.user_name,
        new Date(p.created_at).toLocaleDateString(),
        p.content ?? '',
        String(p.likes),
        (p.community_comments ?? []).map(c => `${c.user_name}: ${c.content}`).join(' | '),
      ])
    ]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'community-board.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  async function handleDelete(postId: string) {
    if (!confirm('Delete this post?')) return
    await fetch(`/api/community/${postId}`, { method: 'DELETE' })
    setPosts(prev => prev.filter(p => p.id !== postId))
  }

  async function handleResolve(postId: string) {
    const res = await fetch(`/api/community/${postId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_resolved: true }),
    })
    if (res.ok) {
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, is_resolved: true } : p))
    }
  }

  async function handleTransfer(post: typeof posts[number]) {
    const res = await fetch('/api/initiatives', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_name: post.title, description: post.content ?? '' }),
    })
    if (res.ok) {
      setTransferredPosts(prev => new Set(prev).add(post.id))
    }
  }

  async function handleDeleteComment(postId: string, commentId: string) {
    if (!confirm('Delete this comment?')) return
    await fetch(`/api/community/${postId}/comments/${commentId}`, { method: 'DELETE' })
    setPosts(prev => prev.map(p =>
      p.id === postId
        ? { ...p, community_comments: (p.community_comments ?? []).filter(c => c.id !== commentId) }
        : p
    ))
  }

  const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000
  const now = Date.now()
  const isRecent = (d: string) => (now - new Date(d).getTime()) < ONE_MONTH_MS

  const recent = [...posts]
    .filter(p => isRecent(p.created_at) && !p.is_resolved)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const ranked = [...posts]
    .filter(p => !isRecent(p.created_at) && !p.is_resolved)
    .sort((a, b) => b.likes - a.likes)

  const resolved = [...posts]
    .filter(p => p.is_resolved)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())

  const renderPost = (post: typeof posts[number], idx: number, showRank: boolean) => {
    const rankClass = idx === 0 ? 'r1' : idx === 1 ? 'r2' : idx === 2 ? 'r3' : 'rn'
    const showComments = expandedComments.has(post.id)
    const isOwner = post.user_email === user.email
    const isNew = (Date.now() - new Date(post.created_at).getTime()) < 86_400_000 * 2
    const commentCount = post.community_comments?.length ?? 0

    const isTransferred = transferredPosts.has(post.id)

    return (
      <div key={post.id} className={`post${post.is_resolved ? ' post-resolved' : ''}`}>
        <div className="post-head">
          <div className="post-avatar"><div className="post-avatar-inner">{initials(post.user_name)}</div></div>
          <div className="post-info">
            <div className="pname">
              {showRank && <span className={`rank-badge ${rankClass}`}>{idx + 1}</span>}
              {post.user_name}
              {isOwner && <span className="post-owner-badge">You</span>}
              {isNew && <span className="new-badge">New</span>}
              {post.is_resolved && <span className="resolved-badge">Resolved</span>}
            </div>
            <div className="pdate">{fmtRelative(post.created_at)}</div>
          </div>
        </div>
        <div className="post-title"><MentionText text={post.title} /></div>
        {post.content && <div className="post-body"><MentionText text={post.content} /></div>}
        <div className="post-bar">
          <button
            className={`like-btn${post.liked_by_user ? ' liked' : ''}`}
            onClick={() => handleLike(post.id)}
          >
            <svg viewBox="0 0 24 24" style={{ width: 13, height: 13 }}><path d="M12 19V5M5 12l7-7 7 7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
            <span>Upvote</span>
            <span className="vote-count">{post.likes}</span>
          </button>
          <button
            className="comment-btn"
            onClick={() => setExpandedComments(prev => {
              const next = new Set(prev)
              next.has(post.id) ? next.delete(post.id) : next.add(post.id)
              return next
            })}
          >
            <svg viewBox="0 0 24 24" style={{ width: 14, height: 14 }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            <span>{commentCount === 0 ? 'Comment' : `${commentCount} ${commentCount === 1 ? 'Comment' : 'Comments'}`}</span>
          </button>
          <button
            className="concern-btn"
            onClick={() => setConcernOpen(prev => {
              const next = new Set(prev)
              next.has(post.id) ? next.delete(post.id) : next.add(post.id)
              return next
            })}
          >
            Concern
          </button>
          <div className="post-bar-right">
            <button
              className={`btn btn-xs${isTransferred ? ' btn-tracker-done' : ' btn-soft'}`}
              onClick={() => !isTransferred && handleTransfer(post)}
              disabled={isTransferred}
            >
              {isTransferred ? 'In Tracker ✓' : 'Send to Tracker'}
            </button>
            {(isOwner || canDelete) && !post.is_resolved && (
              <button className="btn btn-soft btn-xs btn-resolve" onClick={() => handleResolve(post.id)}>
                Resolve
              </button>
            )}
            {(isOwner || canDelete) && (
              <button className="btn btn-danger-o btn-xs" onClick={() => handleDelete(post.id)}>Delete</button>
            )}
          </div>
        </div>

        {concernOpen.has(post.id) && (
          <div className="concern-compose">
            <div className="concern-compose-label">Flag a concern — explain your reasoning (required)</div>
            <textarea
              rows={4}
              placeholder="Describe your concern…"
              value={concernDrafts[post.id] ?? ''}
              onChange={e => {
                const v = e.target.value
                setConcernDrafts(prev => ({ ...prev, [post.id]: v }))
                if (v.trim()) setConcernError(prev => { const n = new Set(prev); n.delete(post.id); return n })
              }}
            />
            {concernError.has(post.id) && (
              <div className="concern-error">You must explain your concern before submitting.</div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button className="btn btn-concern btn-sm" onClick={() => handleConcern(post.id)}>Submit Concern</button>
              <button className="btn btn-soft btn-sm" onClick={() => {
                setConcernOpen(prev => { const n = new Set(prev); n.delete(post.id); return n })
                setConcernError(prev => { const n = new Set(prev); n.delete(post.id); return n })
              }}>Cancel</button>
            </div>
          </div>
        )}

        {showComments && (
          <div className="comments">
            {(post.community_comments ?? []).map(c => {
              const canDeleteComment = c.user_email === user.email || canDelete
              return (
                <div key={c.id} className={`cmt${c.is_concern ? ' cmt-concern' : ''}`}>
                  <div className="cmt-avatar">{initials(c.user_name)}</div>
                  <div className="cmt-body">
                    <div className="cn">
                      {c.is_concern && <span className="concern-tag">Concern</span>}
                      {c.user_name}
                      {canDeleteComment && (
                        <button
                          className="cmt-del"
                          onClick={() => handleDeleteComment(post.id, c.id)}
                          title="Delete comment"
                        >×</button>
                      )}
                    </div>
                    <div className="ct"><MentionText text={c.content} /></div>
                    <div className="cd">{fmtRelative(c.created_at)}</div>
                  </div>
                </div>
              )
            })}
            <div className="cmt-compose">
              <MentionInput
                value={commentDrafts[post.id] ?? ''}
                onChange={(v) => setCommentDrafts(prev => ({ ...prev, [post.id]: v }))}
                onEnter={() => handleComment(post.id)}
                placeholder="Add a comment… (use @ to tag teammates)"
                teamList={teamList}
              />
              <button className="btn btn-soft btn-sm" onClick={() => handleComment(post.id)} disabled={submittingSet.has(post.id)}>{submittingSet.has(post.id) ? 'Posting…' : 'Reply'}</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      {/* Compose */}
      <div className="compose">
        <div className="compose-top">
          <div className="compose-avatar">{initials(user.name)}</div>
          <span>Share with the team</span>
        </div>
        <input
          type="text"
          placeholder="Pitch your idea…"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
        <MentionInput
          value={content}
          onChange={setContent}
          placeholder="What's the idea? What problem does it solve? The team will vote to rank ideas by priority. Use @Name to tag someone or @everyone for the whole team."
          teamList={teamList}
          multiline
          rows={3}
        />
        <div className="compose-footer">
          <span className="compose-tip">Tip: Type <strong>@Name</strong> to notify someone &bull; New ideas stay featured for 2 weeks, then get ranked by team votes</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-soft btn-sm" onClick={handleExport} disabled={posts.length === 0}>
              <svg viewBox="0 0 24 24" style={{ width: 13, height: 13, marginRight: 4 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
              Export
            </button>
            <button className="btn btn-grad btn-sm" onClick={handlePost} disabled={posting || !title.trim()}>
              <svg viewBox="0 0 24 24" style={{ width: 13, height: 13, marginRight: 4 }}><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" /></svg>
              {posting ? 'Posting…' : 'Post'}
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /><div>Loading…</div></div>
      ) : posts.length === 0 ? (
        <div className="empty">
          <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
          <h3>No ideas yet</h3>
          <p>Be the first to share an idea.</p>
        </div>
      ) : (
        <>
          {recent.length > 0 && (
            <>
              <h2 className="community-section-h">New This Month</h2>
              {recent.map((post, idx) => renderPost(post, idx, false))}
            </>
          )}
          {ranked.length > 0 && (
            <>
              <h2 className="community-section-h">Top Ideas</h2>
              {ranked.map((post, idx) => renderPost(post, idx, true))}
            </>
          )}
          {resolved.length > 0 && (
            <>
              <h2 className="community-section-h">Resolved</h2>
              {resolved.map((post, idx) => renderPost(post, idx, false))}
            </>
          )}
        </>
      )}
    </>
  )
}
