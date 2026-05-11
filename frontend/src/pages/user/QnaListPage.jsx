import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import DashboardLayout from '../../components/DashboardLayout'
import { Badge } from '@/components/ui/badge'
import { inputCls } from '@/lib/ui'
import { listQna } from '../../api/qna'
import { useDebounce } from '../../hooks/useDebounce'

const SOCKET_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5300/api').replace('/api', '')

const LIMIT = 10

function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null

  const pages = []
  const delta = 2
  const left = Math.max(1, page - delta)
  const right = Math.min(totalPages, page + delta)

  if (left > 1) { pages.push(1); if (left > 2) pages.push('…') }
  for (let i = left; i <= right; i++) pages.push(i)
  if (right < totalPages) { if (right < totalPages - 1) pages.push('…'); pages.push(totalPages) }

  return (
    <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
      <p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="h-8 px-3 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Previous
        </button>
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`ellipsis-${i}`} className="h-8 w-8 flex items-center justify-center text-xs text-muted-foreground">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={`h-8 w-8 rounded-md text-sm transition-colors ${p === page
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          className="h-8 px-3 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  )
}

export default function QnaListPage() {
  const navigate = useNavigate()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const debouncedSearch = useDebounce(search, 800)

  const fetchPosts = useCallback((params) => {
    setLoading(true)
    listQna(params)
      .then((res) => {
        setPosts(res.data.posts || [])
        setTotalPages(res.data.totalPages || 1)
        setTotal(res.data.total || 0)
      })
      .catch(() => { })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const params = { page, limit: LIMIT }
    if (debouncedSearch.trim().length >= 3) params.search = debouncedSearch.trim()
    fetchPosts(params)
  }, [debouncedSearch, page, fetchPosts])

  // Stable key derived from current visible post IDs — re-runs socket when list changes
  const postIdsKey = useMemo(() => posts.map((p) => p._id).join(','), [posts])

  useEffect(() => {
    if (posts.length === 0) return
    const ids = posts.map((p) => p._id)
    const token = localStorage.getItem('jwt')
    const socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket', 'polling'] })

    socket.on('connect', () => {
      ids.forEach((id) => socket.emit('qna:join', { qna_id: id }))
    })

    socket.on('question:new', (question) => {
      setPosts((prev) =>
        prev.map((p) =>
          String(p._id) === String(question.qna_id)
            ? { ...p, question_count: (p.question_count || 0) + 1 }
            : p
        )
      )
    })

    return () => {
      ids.forEach((id) => socket.emit('qna:leave', { qna_id: id }))
      socket.disconnect()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postIdsKey])

  function handleSearchChange(e) {
    setSearch(e.target.value)
    setPage(1)
  }

  return (
    <DashboardLayout title="Q&A Boards" subtitle="Browse and join discussions">
      <div className="max-w-3xl space-y-4">

        {/* Search bar */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
          </svg>
          <input
            className={`${inputCls} pl-9`}
            value={search}
            onChange={handleSearchChange}
            placeholder="Search Q&A boards..."
          />
        </div>

        {/* Results count */}
        {!loading && (
          <p className="text-xs text-muted-foreground">
            {total === 0 ? 'No results' : `${total} board${total !== 1 ? 's' : ''}`}
            {search ? ' matching your search' : ''}
          </p>
        )}

        {/* List */}
        {loading ? (
          <div className="py-20 text-center text-sm text-muted-foreground">Loading...</div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            {search ? (
              <>
                <p className="text-sm font-medium text-foreground">No boards found</p>
                <p className="text-sm text-muted-foreground mt-1">Try a different search term.</p>
                <button
                  onClick={() => { setSearch(''); setPage(1) }}
                  className="mt-4 text-sm text-primary hover:underline"
                >
                  Clear search
                </button>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground">No Q&A boards available</p>
                <p className="text-sm text-muted-foreground mt-1">Check back later for new discussions.</p>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {posts.map((post) => (
                <button
                  key={post._id}
                  onClick={() => navigate(`/user/qna/${post._id}`)}
                  className="w-full bg-card border border-border rounded-xl px-5 py-4 text-left hover:border-primary/30 hover:shadow-sm transition-all group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                          {post.title}
                        </span>
                        <Badge
                          variant={post.visibility === 'PUBLIC' ? 'default' : 'secondary'}
                          className="shrink-0 text-xs"
                        >
                          {post.visibility === 'PUBLIC' ? 'Public' : 'Invited'}
                        </Badge>
                      </div>
                      {post.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1 mb-1">{post.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {post.question_count || 0} question{post.question_count !== 1 ? 's' : ''}
                        <span className="mx-1.5">·</span>
                        {new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    <svg className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5 group-hover:text-primary transition-colors" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>

            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
