import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import { SOCKET_URL } from '../../lib/socket'
import DashboardLayout from '@/layouts/DashboardLayout'
import { Button } from '@/components/Button'
import { listQna, deleteQna } from '../../api/qna'
import { useDebounce } from '../../hooks/useDebounce'
import toast from 'react-hot-toast'
import { VisibilityBadge, StatusBadge } from '@/components/Badges'
import { Pagination } from '@/components/qna/Pagination'
import { EmptyState } from '@/components/feedback/EmptyState'
import { PageError } from '@/components/feedback/PageError'
import { InlineConfirm } from '@/components/InlineConfirm'
import { Skeleton } from '@/components/feedback/Skeleton'
import { SearchInput } from '@/components/qna/SearchInput'
import { Surface } from '@/components/Surface'
import { Stack } from '@/components/Stack'
import { Text } from '@/components/Text'

const LIMIT = 10

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
  const pageRef = useRef(page)
  useEffect(() => { pageRef.current = page }, [page])

  // Real-time board list updates
  useEffect(() => {
    const token = localStorage.getItem('jwt')
    const socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket', 'polling'] })

    socket.on('qna:new', ({ post }) => {
      if (pageRef.current !== 1) return
      setPosts((prev) => {
        if (prev.some((p) => p._id === post._id)) return prev
        return [post, ...prev]
      })
      setTotal((t) => t + 1)
    })

    socket.on('qna:deleted', ({ qna_id }) => {
      setPosts((prev) => {
        const exists = prev.some((p) => String(p._id) === String(qna_id))
        if (exists) setTotal((t) => Math.max(0, t - 1))
        return prev.filter((p) => String(p._id) !== String(qna_id))
      })
    })

    socket.on('qna:updated', ({ post }) => {
      setPosts((prev) => prev.map((p) => String(p._id) === String(post._id) ? { ...p, ...post } : p))
    })

    socket.on('question:count_change', ({ qna_id, delta }) => {
      setPosts((prev) =>
        prev.map((p) =>
          String(p._id) === String(qna_id)
            ? { ...p, question_count: Math.max(0, (p.question_count || 0) + delta) }
            : p
        )
      )
    })

    return () => { socket.disconnect() }
  }, [])

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
      toast.success('Q&A board deleted.')
    } catch {
      toast.error('Failed to delete board. Please try again.')
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
        title="Q&A Boards"
        subtitle="Manage all Q&A boards"
        actions={
          <Button onClick={() => navigate('/admin/qna/create')}>
            + Add Q&A Board
          </Button>
        }
      >
        <Stack gap={5} className="max-w-5xl">

          {/* Search + filter bar */}
          <div className="flex items-center gap-3">
            <SearchInput
              className="flex-1"
              value={search}
              onChange={handleSearchChange}
              placeholder="Search boards..."
            />
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
            <Text size="xs" color="muted">
              {total === 0 ? 'No results' : `${total} board${total !== 1 ? 's' : ''}`}
              {(search || visibility) ? ' matching your filters' : ''}
            </Text>
          )}

          {/* List */}
          {loading ? (
            <Stack gap={2}>
              {[...Array(5)].map((_, i) => (
                <Surface key={i} className="px-5 py-4 flex items-center justify-between gap-4">
                  <Stack gap={2} className="flex-1">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </Stack>
                  <div className="flex gap-2">
                    <Skeleton className="h-9 w-14 rounded-xl" />
                    <Skeleton className="h-9 w-16 rounded-xl" />
                  </div>
                </Surface>
              ))}
            </Stack>
          ) : fetchError ? (
            <PageError
              heading="Failed to load boards"
              action={{ label: 'Retry', onClick: () => fetchPosts({ page, limit: LIMIT }) }}
            />
          ) : posts.length === 0 ? (
            search || visibility ? (
              <EmptyState
                heading="No boards found"
                description="Try adjusting your search or filters."
                action={{ label: 'Clear filters', onClick: () => { setSearch(''); setVisibility(''); setPage(1) } }}
              />
            ) : (
              <EmptyState
                heading="No Q&A boards yet"
                description="Create your first Q&A board to get started."
                action={{ label: 'Create Q&A Board', onClick: () => navigate('/admin/qna/create'), primary: true }}
              />
            )
          ) : (
            <>
              <Stack gap={2}>
                {posts.map((post) => (
                  <Surface
                    key={post._id}
                    className="px-5 py-4 flex items-center justify-between gap-4 hover:border-slate-300 hover:shadow-md transition-all duration-200"
                  >
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => navigate(`/admin/qna/${post._id}`)}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-sm font-semibold text-slate-900 truncate">{post.title}</span>
                        <VisibilityBadge visibility={post.visibility} />
                        <StatusBadge isClosed={post.status === 'CLOSED' || (post.end_at && new Date() >= new Date(post.end_at))} />
                      </div>
                      {post.description && (
                        <Text size="xs" className="truncate mb-1">{post.description}</Text>
                      )}
                      <Text size="xs" color="muted">
                        {post.question_count || 0} Question{post.question_count !== 1 ? 's' : ''}
                        <span className="mx-1.5">·</span>
                        {new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Text>
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
                        <InlineConfirm onConfirm={() => handleDelete(post._id)} onCancel={() => setConfirmId(null)} />
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
                  </Surface>
                ))}
              </Stack>

              <Pagination page={page} totalPages={totalPages} onChange={setPage} />
            </>
          )}
        </Stack>
    </DashboardLayout>
  )
}
