'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { CommunityPost, CommunityComment, TeamMember } from '@/types'
import { initials, fmtRelative } from '@/lib/ui'
import MentionInput from '@/components/shared/MentionInput'

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
    if (!text) return
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
  }

  async function handleDelete(postId: string) {
    if (!confirm('Delete this post?')) return
    await fetch(`/api/community/${postId}`, { method: 'DELETE' })
    setPosts(prev => prev.filter(p => p.id !== postId))
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
    .filter(p => isRecent(p.created_at))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const ranked = [...posts]
    .filter(p => !isRecent(p.created_at))
    .sort((a, b) => b.likes - a.likes)

  const renderPost = (post: typeof posts[number], idx: number, showRank: boolean) => {
    const rankClass = idx === 0 ? 'r1' : idx === 1 ? 'r2' : idx === 2 ? 'r3' : 'rn'
    const showComments = expandedComments.has(post.id)
    const isOwner = post.user_email === user.email
    const isNew = (Date.now() - new Date(post.created_at).getTime()) < 86_400_000 * 2
    const commentCount = post.community_comments?.length ?? 0

    return (
      <div key={post.id} className="post">
        <div className="post-head">
          <div className="post-avatar"><div className="post-avatar-inner">{initials(post.user_name)}</div></div>
          <div className="post-info">
            <div className="pname">
              {showRank && <span className={`rank-badge ${rankClass}`}>{idx + 1}</span>}
              {post.user_name}
              {isOwner && <span className="post-owner-badge">You</span>}
              {isNew && <span className="new-badge">New</span>}
            </div>
            <div className="pdate">{fmtRelative(post.created_at)}</div>
          </div>
        </div>
        <div className="post-title">{post.title}</div>
        {post.content && <div className="post-body">{post.content}</div>}
        <div className="post-bar">
          <button
            className={`like-btn${post.liked_by_user ? ' liked' : ''}`}
            onClick={() => handleLike(post.id)}
          >
            <svg viewBox="0 0 24 24" style={{ width: 14, height: 14 }}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
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
          {(isOwner || canDelete) && (
            <div className="post-bar-right">
              <button className="btn btn-danger-o btn-xs" onClick={() => handleDelete(post.id)}>Delete</button>
            </div>
          )}
        </div>

        {showComments && (
          <div className="comments">
            {(post.community_comments ?? []).map(c => {
              const canDeleteComment = c.user_email === user.email || canDelete
              return (
                <div key={c.id} className="cmt">
                  <div className="cmt-avatar">{initials(c.user_name)}</div>
                  <div className="cmt-body">
                    <div className="cn">
                      {c.user_name}
                      {canDeleteComment && (
                        <button
                          className="cmt-del"
                          onClick={() => handleDeleteComment(post.id, c.id)}
                          title="Delete comment"
                        >×</button>
                      )}
                    </div>
                    <div className="ct">{c.content}</div>
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
              <button className="btn btn-soft btn-sm" onClick={() => handleComment(post.id)}>Reply</button>
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
          <span>{user.name}</span>
        </div>
        <input
          type="text"
          placeholder="Share an idea or suggestion…"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
        <MentionInput
          value={content}
          onChange={setContent}
          placeholder="Add more detail (optional)… (use @ to tag teammates)"
          teamList={teamList}
          multiline
          rows={3}
        />
        <div className="compose-footer">
          <button className="btn btn-grad btn-sm" onClick={handlePost} disabled={posting || !title.trim()}>
            {posting ? 'Posting…' : 'Post Idea'}
          </button>
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
        </>
      )}
    </>
  )
}
