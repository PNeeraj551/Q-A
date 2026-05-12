import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import DashboardLayout from '../../components/DashboardLayout'
import { listQna } from '../../api/qna'
import { useDebounce } from '../../hooks/useDebounce'
import { StaggerList, StaggerItem, FadeUp } from '../../lib/motion'

const SOCKET_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5300/api').replace('/api', '')

const LIMIT = 10

function VisibilityBadge({ visibility }) {
  if (visibility === 'PUBLIC') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
        Public
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
      Invited
    </span>
  )
}

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
    <div className="flex items-center justify-between pt-4 border-t border-slate-200 mt-4">
      <p className="text-xs text-slate-400">Page {page} of {totalPages}</p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="h-8 px-3 rounded-lg text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
        >
          Previous
        </button>
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`ellipsis-${i}`} className="h-8 w-8 flex items-center justify-center text-xs text-slate-400">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={`h-8 w-8 rounded-lg text-sm transition-all duration-200 ${p === page
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium shadow-sm'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          className="h-8 px-3 rounded-lg text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
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
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
          </svg>
          <input
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:border-blue-400 transition-all duration-200"
            value={search}
            onChange={handleSearchChange}
            placeholder="Search Q&A boards..."
          />
        </div>

        {/* Results count */}
        {!loading && (
          <p className="text-xs text-slate-400">
            {total === 0 ? 'No results' : `${total} board${total !== 1 ? 's' : ''}`}
            {search ? ' matching your search' : ''}
          </p>
        )}

        {/* List */}
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-2xl px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-100 rounded-xl animate-pulse w-48" />
                    <div className="h-3 bg-slate-100 rounded-xl animate-pulse w-full" />
                    <div className="h-3 bg-slate-100 rounded-xl animate-pulse w-32" />
                  </div>
                  <div className="h-4 w-4 bg-slate-100 rounded-xl animate-pulse shrink-0 mt-0.5" />
                </div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <FadeUp className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            {search ? (
              <>
                <p className="text-base font-bold text-slate-900">No boards found</p>
                <p className="text-sm text-slate-500 mt-1.5">Try a different search term.</p>
                <button
                  onClick={() => { setSearch(''); setPage(1) }}
                  className="mt-5 text-sm text-blue-600 hover:text-blue-700 font-semibold transition-colors duration-200"
                >
                  Clear search
                </button>
              </>
            ) : (
              <>
                <p className="text-base font-bold text-slate-900">No Q&A boards available</p>
                <p className="text-sm text-slate-500 mt-1.5">Check back later for new discussions.</p>
              </>
            )}
          </FadeUp>
        ) : (
          <>
            <StaggerList className="space-y-2">
              {posts.map((post) => (
                <StaggerItem key={post._id}>
                <button
                  onClick={() => navigate(`/user/qna/${post._id}`)}
                  className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-left shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-200 group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors duration-200 truncate">
                          {post.title}
                        </span>
                        <VisibilityBadge visibility={post.visibility} />
                      </div>
                      {post.description && (
                        <p className="text-sm text-slate-500 line-clamp-2 mb-1.5">{post.description}</p>
                      )}
                      <p className="text-xs text-slate-400">
                        {post.question_count || 0} question{post.question_count !== 1 ? 's' : ''}
                        <span className="mx-1.5">·</span>
                        {new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    <svg className="w-4 h-4 text-slate-300 shrink-0 mt-0.5 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all duration-200" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
                </StaggerItem>
              ))}
            </StaggerList>

            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
