import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { inputCls } from '@/lib/ui'
import { listQna, deleteQna } from '../../api/qna'
import { useDebounce } from '../../hooks/useDebounce'
import { Toast } from '../../components/Toast'
import { useToast } from '../../hooks/useToast'

function Skeleton({ className }) {
  return <div className={`bg-muted rounded-md animate-pulse ${className}`} />
}

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
              className={`h-8 w-8 rounded-md text-sm transition-colors ${
                p === page
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

export default function QnaDashboard() {
  const navigate = useNavigate()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [confirmId, setConfirmId] = useState(null)
  const { toast, show: showToast, dismiss } = useToast()

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
    setDeletingId(id)
    try {
      await deleteQna(id)
      setPosts((prev) => prev.filter((p) => p._id !== id))
      setTotal((t) => t - 1)
      showToast('Q&A post deleted.', 'success')
    } catch {
      showToast('Failed to delete. Please try again.', 'error')
    } finally {
      setDeletingId(null)
      setConfirmId(null)
    }
  }

  const visibilityOptions = [
    { value: '', label: 'All' },
    { value: 'PUBLIC', label: 'Public' },
    { value: 'PRIVATE', label: 'Private' },
  ]

  return (
    <>
    <DashboardLayout
      title="Q&A Posts"
      subtitle="Manage all Q&A boards"
      actions={
        <Button onClick={() => navigate('/admin/qna/create')}>
          + New Q&A
        </Button>
      }
    >
      <div className="max-w-3xl space-y-4">

        {/* Search + filter bar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
            </svg>
            <input
              className={`${inputCls} pl-9`}
              value={search}
              onChange={handleSearchChange}
              placeholder="Search Q&A posts..."
            />
          </div>
          <div className="flex items-center gap-1 border border-border rounded-md p-0.5 shrink-0">
            {visibilityOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleVisibilityChange(opt.value)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  visibility === opt.value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Results count */}
        {!loading && (
          <p className="text-xs text-muted-foreground">
            {total === 0 ? 'No results' : `${total} post${total !== 1 ? 's' : ''}`}
            {(search || visibility) ? ' matching your filters' : ''}
          </p>
        )}

        {/* List */}
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-xl px-5 py-4 flex items-center justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-14 rounded-md" />
                  <Skeleton className="h-8 w-16 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        ) : fetchError ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-destructive" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 8v4m0 4h.01" />
              </svg>
            </div>
            <p className="text-sm font-medium text-foreground">Failed to load posts</p>
            <p className="text-sm text-muted-foreground mt-1">Check your connection and try again.</p>
            <button onClick={() => fetchPosts({ page, limit: LIMIT })} className="mt-4 text-sm text-primary hover:underline">
              Retry
            </button>
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            {search || visibility ? (
              <>
                <p className="text-sm font-medium text-foreground">No posts found</p>
                <p className="text-sm text-muted-foreground mt-1">Try adjusting your search or filters.</p>
                <button
                  onClick={() => { setSearch(''); setVisibility(''); setPage(1) }}
                  className="mt-4 text-sm text-primary hover:underline"
                >
                  Clear filters
                </button>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground">No Q&A posts yet</p>
                <p className="text-sm text-muted-foreground mt-1">Create your first Q&A board to get started.</p>
                <Button className="mt-5" onClick={() => navigate('/admin/qna/create')}>
                  Create Q&A
                </Button>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {posts.map((post) => (
                <div
                  key={post._id}
                  className="bg-card border border-border rounded-xl px-5 py-4 flex items-center justify-between gap-4 hover:border-border/60 transition-colors"
                >
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => navigate(`/admin/qna/${post._id}`)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-foreground truncate">{post.title}</span>
                      <Badge
                        variant={post.visibility === 'PUBLIC' ? 'default' : 'secondary'}
                        className="shrink-0 text-xs"
                      >
                        {post.visibility === 'PUBLIC' ? 'Public' : 'Private'}
                      </Badge>
                    </div>
                    {post.description && (
                      <p className="text-xs text-muted-foreground truncate mb-1">{post.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
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
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={deletingId === post._id}
                          onClick={() => handleDelete(post._id)}
                        >
                          {deletingId === post._id ? 'Deleting...' : 'Confirm'}
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
                </div>
              ))}
            </div>

            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </>
        )}
      </div>
    </DashboardLayout>
    {toast && <Toast key={toast.key} message={toast.message} type={toast.type} onDismiss={dismiss} />}
  </>
  )
}
