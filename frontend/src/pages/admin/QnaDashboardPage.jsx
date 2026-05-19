import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import supabase from '../../utils/supabase'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Button } from '@/components/common/Button'
import { listQna, deleteQna } from '../../api/qna'
import { useDebounce } from '../../hooks/useDebounce'
import toast from 'react-hot-toast'
import { VisibilityBadge, StatusBadge } from '@/components/common/Badges'
import { Pagination } from '@/components/qna/Pagination'
import { EmptyState } from '@/components/common/EmptyState'
import { PageError } from '@/components/common/PageError'
import { InlineConfirm } from '@/components/common/InlineConfirm'
import { Skeleton } from '@/components/common/Skeleton'
import { QnaFilters } from '@/components/qna/QnaFilters'
import { Surface } from '@/components/common/Surface'
import { Stack } from '@/components/common/Stack'
import { Text } from '@/components/common/Text'

const LIMIT = 10

export default function QnaDashboardPage() {
  const navigate = useNavigate()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const deletingRef = useRef(new Set())
  const [confirmId, setConfirmId] = useState(null)

  const [search, setSearch] = useState('')
  const [visibility, setVisibility] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [datePreset, setDatePreset] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const debouncedSearch = useDebounce(search, 800)
  const hasActiveSearch = debouncedSearch.trim().length >= 1
  const isSearchClearing = search.trim().length < 1 && hasActiveSearch
  const hasActiveFilters = hasActiveSearch || !!visibility || !!datePreset
  const pageRef = useRef(page)
  useEffect(() => { pageRef.current = page }, [page])

  // Real-time board list updates
  useEffect(() => {
    const channel = supabase
      .channel('qna_global')
      .on('broadcast', { event: 'qna:new' }, ({ payload: { post } }) => {
        if (pageRef.current !== 1) return
        setPosts((prev) => {
          if (prev.some((p) => p.id === post.id)) return prev
          return [post, ...prev]
        })
        setTotal((t) => t + 1)
      })
      .on('broadcast', { event: 'qna:deleted' }, ({ payload: { qna_id } }) => {
        setPosts((prev) => {
          const exists = prev.some((p) => String(p.id) === String(qna_id))
          if (exists) setTotal((t) => Math.max(0, t - 1))
          return prev.filter((p) => String(p.id) !== String(qna_id))
        })
      })
      .on('broadcast', { event: 'qna:updated' }, ({ payload: { post } }) => {
        setPosts((prev) => prev.map((p) => String(p.id) === String(post.id) ? { ...p, ...post } : p))
      })
      .on('broadcast', { event: 'question:count_change' }, ({ payload: { qna_id, delta } }) => {
        setPosts((prev) =>
          prev.map((p) =>
            String(p.id) === String(qna_id)
              ? { ...p, question_count: Math.max(0, (p.question_count || 0) + delta) }
              : p
          )
        )
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
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
    if (debouncedSearch.trim().length >= 1) params.search = debouncedSearch.trim()
    if (visibility) params.visibility = visibility
    if (fromDate) params.fromDate = fromDate
    if (toDate) params.toDate = toDate
    fetchPosts(params)
  }, [debouncedSearch, visibility, fromDate, toDate, page, fetchPosts])

  function toISO(d) { return d.toISOString().split('T')[0] }

  function handleSetDatePreset(preset) {
    setDatePreset(preset)
    const today = new Date()
    if (preset === 'last24h') {
      const from = new Date(today); from.setDate(from.getDate() - 1)
      setFromDate(toISO(from)); setToDate(toISO(today))
    } else if (preset === 'last7') {
      const from = new Date(today); from.setDate(from.getDate() - 7)
      setFromDate(toISO(from)); setToDate(toISO(today))
    } else if (preset === 'last30') {
      const from = new Date(today); from.setDate(from.getDate() - 30)
      setFromDate(toISO(from)); setToDate(toISO(today))
    } else if (preset === 'thisMonth') {
      const from = new Date(today.getFullYear(), today.getMonth(), 1)
      setFromDate(toISO(from)); setToDate(toISO(today))
    } else if (preset !== 'custom') {
      setFromDate(''); setToDate('')
    }
    setPage(1)
  }

  function handleSetSearch(v) { setSearch(v); setPage(1) }
  function handleSetVisibility(v) { setVisibility(v); setPage(1) }
  function handleSetFromDate(v) { setFromDate(v); if (toDate && v > toDate) setToDate(''); setPage(1) }
  function handleSetToDate(v) { setToDate(v); setPage(1) }
  function handleClearFilters() { setSearch(''); setVisibility(''); setFromDate(''); setToDate(''); setDatePreset(''); setPage(1) }

  async function handleDelete(id) {
    if (deletingRef.current.has(id)) return
    deletingRef.current.add(id)
    try {
      await deleteQna(id)
      setPosts((prev) => prev.filter((p) => p.id !== id))
      setTotal((t) => t - 1)
      toast.success('Q&A board deleted.')
    } catch {
      toast.error('Failed to delete board. Please try again.')
    } finally {
      deletingRef.current.delete(id)
      setConfirmId(null)
    }
  }

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
          <QnaFilters
            search={search} setSearch={handleSetSearch}
            visibility={visibility} setVisibility={handleSetVisibility}
            fromDate={fromDate} setFromDate={handleSetFromDate}
            toDate={toDate} setToDate={handleSetToDate}
            datePreset={datePreset} setDatePreset={handleSetDatePreset}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={handleClearFilters}
            role="admin"
          />

          {/* Results count */}
          {!loading && !isSearchClearing && (
            <Text size="xs" color="muted">
              {total === 0 ? 'No results' : `${total} board${total !== 1 ? 's' : ''}`}
              {hasActiveFilters ? ' matching your filters' : ''}
            </Text>
          )}

          {/* List */}
          {loading || isSearchClearing ? (
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
            hasActiveFilters ? (
              <EmptyState
                heading="No boards found"
                description="Try adjusting your search or filters."
                action={{ label: 'Clear filters', onClick: handleClearFilters }}
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
                    key={post.id}
                    className="px-5 py-4 flex items-center justify-between gap-4 hover:border-slate-300 hover:shadow-md transition-all duration-200"
                  >
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => navigate(`/admin/qna/${post.id}`)}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-semibold text-slate-900 truncate">{post.title}</span>
                        <VisibilityBadge visibility={post.visibility} />
                        <StatusBadge isClosed={post.status === 'CLOSED' || (post.end_at && new Date() >= new Date(post.end_at))} />
                      </div>
                      {post.description && (
                        <Text size="xs" className="truncate mb-1.5">{post.description}</Text>
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
                        onClick={() => navigate(`/admin/qna/${post.id}/edit`)}
                      >
                        Edit
                      </Button>
                      {confirmId === post.id ? (
                        <InlineConfirm onConfirm={() => handleDelete(post.id)} onCancel={() => setConfirmId(null)} />
                      ) : (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setConfirmId(post.id)}
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
