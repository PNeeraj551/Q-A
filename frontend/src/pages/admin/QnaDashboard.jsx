import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import { Button, MotionButton } from '@/components/ui/button'
import { listQna, deleteQna } from '../../api/qna'
import { useDebounce } from '../../hooks/useDebounce'
import toast from 'react-hot-toast'
import { StaggerList, StaggerItem, FadeUp } from '../../lib/motion'

function Skeleton({ className }) {
  return <div className={`bg-slate-100 rounded-xl animate-pulse ${className}`} />
}

const LIMIT = 10

function VisibilityBadge({ visibility }) {
  if (visibility === 'PUBLIC') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" strokeLinejoin="round" d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" />
        </svg>
        Public
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path strokeLinecap="round" strokeLinejoin="round" d="M7 11V7a5 5 0 0110 0v4" />
      </svg>
      Private
    </span>
  )
}

function StatusBadge({ post }) {
  const isClosed = post.status === 'CLOSED' || (post.end_at && new Date() >= new Date(post.end_at))
  if (isClosed) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
        Closed
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
      Open
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

export default function QnaDashboard() {
  const navigate = useNavigate()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const deletingRef = useRef(new Set())
  const [confirmId, setConfirmId] = useState(null)

  const [search, setSearch] = useState('')
  const [visibility, setVisibility] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const debouncedSearch = useDebounce(search, 800)

  const fetchPosts = useCallback((params) => {
    setLoading(true)
    setFetchError(false)
    listQna(params)
      .then((res) => {
        setPosts(res.data.posts || [])
        setTotalPages(res.data.totalPages || 1)
        setTotal(res.data.total || 0)
      })
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const params = { page, limit: LIMIT }
    if (debouncedSearch.trim().length >= 3) params.search = debouncedSearch.trim()
    if (visibility) params.visibility = visibility
    fetchPosts(params)
  }, [debouncedSearch, visibility, page, fetchPosts])

  function handleSearchChange(e) {
    setSearch(e.target.value)
    setPage(1)
  }

  function handleVisibilityChange(v) {
    setVisibility(v)
    setPage(1)
  }

  async function handleDelete(id) {
    if (deletingRef.current.has(id)) return
    deletingRef.current.add(id)
    try {
      await deleteQna(id)
      setPosts((prev) => prev.filter((p) => p._id !== id))
      setTotal((t) => t - 1)
      toast.success('Q&A post deleted.')
    } catch {
      toast.error('Failed to delete. Please try again.')
    } finally {
      deletingRef.current.delete(id)
      setConfirmId(null)
    }
  }

  const visibilityOptions = [
    { value: '', label: 'All' },
    { value: 'PUBLIC', label: 'Public' },
    { value: 'PRIVATE', label: 'Private' },
  ]

  return (
    <DashboardLayout
        title="Q&A"
        subtitle="Manage all Q&A boards"
        actions={
          <MotionButton
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/admin/qna/create')}
          >
            + New Q&A
          </MotionButton>
        }
      >
        <div className="max-w-5xl space-y-5">

          {/* Search + filter bar */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
              </svg>
              <input
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:border-blue-400 transition-all duration-200"
                value={search}
                onChange={handleSearchChange}
                placeholder="Search Q&A..."
              />
            </div>
            <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 shrink-0">
              {visibilityOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleVisibilityChange(opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${visibility === opt.value
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-white'
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Results count */}
          {!loading && (
            <p className="text-xs text-slate-400">
              {total === 0 ? 'No results' : `${total} post${total !== 1 ? 's' : ''}`}
              {(search || visibility) ? ' matching your filters' : ''}
            </p>
          )}

          {/* List */}
          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-white border border-slate-200 rounded-2xl px-5 py-4 flex items-center justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-9 w-14 rounded-xl" />
                    <Skeleton className="h-9 w-16 rounded-xl" />
                  </div>
                </div>
              ))}
            </div>
          ) : fetchError ? (
            <FadeUp className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 8v4m0 4h.01" />
                </svg>
              </div>
              <p className="text-base font-bold text-slate-900">Failed to load posts</p>
              <p className="text-sm text-slate-500 mt-1.5">Check your connection and try again.</p>
              <button onClick={() => fetchPosts({ page, limit: LIMIT })} className="mt-5 text-sm text-blue-600 hover:text-blue-700 font-semibold transition-colors duration-200">
                Retry
              </button>
            </FadeUp>
          ) : posts.length === 0 ? (
            <FadeUp className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              {search || visibility ? (
                <>
                  <p className="text-base font-bold text-slate-900">No posts found</p>
                  <p className="text-sm text-slate-500 mt-1.5">Try adjusting your search or filters.</p>
                  <button
                    onClick={() => { setSearch(''); setVisibility(''); setPage(1) }}
                    className="mt-5 text-sm text-blue-600 hover:text-blue-700 font-semibold transition-colors duration-200"
                  >
                    Clear filters
                  </button>
                </>
              ) : (
                <>
                  <p className="text-base font-bold text-slate-900">No Q&A yet</p>
                  <p className="text-sm text-slate-500 mt-1.5">Create your first Q&A board to get started.</p>
                  <Button className="mt-5" onClick={() => navigate('/admin/qna/create')}>
                    Create Q&A
                  </Button>
                </>
              )}
            </FadeUp>
          ) : (
            <>
              <StaggerList className="space-y-2">
                {posts.map((post) => (
                  <StaggerItem
                    key={post._id}
                    className="bg-white border border-slate-200 rounded-2xl px-5 py-4 flex items-center justify-between gap-4 hover:border-slate-300 hover:shadow-md transition-all duration-200"
                  >
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => navigate(`/admin/qna/${post._id}`)}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-sm font-semibold text-slate-900 truncate">{post.title}</span>
                        <VisibilityBadge visibility={post.visibility} />
                        <StatusBadge post={post} />
                      </div>
                      {post.description && (
                        <p className="text-xs text-slate-500 truncate mb-1">{post.description}</p>
                      )}
                      <p className="text-xs text-slate-400">
                        {post.question_count || 0} question{post.question_count !== 1 ? 's' : ''}
                        <span className="mx-1.5">·</span>
                        {new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/admin/qna/${post._id}/edit`)}
                      >
                        Edit
                      </Button>
                      {confirmId === post._id ? (
                        <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-xl px-2 py-1">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(post._id)}
                          >
                            Confirm
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setConfirmId(null)}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setConfirmId(post._id)}
                        >
                          Delete
                        </Button>
                      )}
                    </div>
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
