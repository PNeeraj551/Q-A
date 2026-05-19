import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import supabase from '../../utils/supabase'
import { useAuth } from '../../context/AuthContext'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { listQna } from '../../api/qna'
import { useDebounce } from '../../hooks/useDebounce'
import { VisibilityBadge, StatusBadge } from '@/components/common/Badges'
import { Pagination } from '@/components/qna/Pagination'
import { EmptyState } from '@/components/common/EmptyState'
import { Skeleton } from '@/components/common/Skeleton'
import { QnaFilters } from '@/components/qna/QnaFilters'
import { Surface } from '@/components/common/Surface'
import { Stack } from '@/components/common/Stack'
import { Text } from '@/components/common/Text'

const LIMIT = 10

export default function QnaListPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [visibility, setVisibility] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const debouncedSearch = useDebounce(search, 800)
  const hasActiveSearch = debouncedSearch.trim().length >= 1
  const isSearchClearing = search.trim().length < 1 && hasActiveSearch
  const hasActiveFilters = hasActiveSearch || !!visibility || !!fromDate || !!toDate
  const pageRef = useRef(page)
  const searchRef = useRef(debouncedSearch)
  useEffect(() => { pageRef.current = page }, [page])
  useEffect(() => { searchRef.current = debouncedSearch }, [debouncedSearch])

  const currentUserId = user?.id || user?.user_id

  const fetchPosts = useCallback((params) => {
    setLoading(true)
    listQna(params)
      .then((res) => {
        setPosts(res.data.posts || [])
        setTotalPages(res.data.totalPages || 1)
        setTotal(res.data.total || 0)
      })
      .catch(() => {})
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

  // Real-time board list updates
  useEffect(() => {
    const channel = supabase
      .channel('qna_global')
      .on('broadcast', { event: 'qna:new' }, ({ payload: { post } }) => {
        if (pageRef.current !== 1) return
        const term = searchRef.current.trim()
        if (term.length >= 1 && !post.title.toLowerCase().includes(term.toLowerCase())) return
        if (post.visibility === 'PRIVATE') {
          const ids = (post.allowed_users || []).map(String)
          if (!ids.includes(String(currentUserId))) return
        }
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId])

  function handleSetSearch(v) { setSearch(v); setPage(1) }
  function handleSetVisibility(v) { setVisibility(v); setPage(1) }
  function handleSetFromDate(v) { setFromDate(v); if (toDate && v > toDate) setToDate(''); setPage(1) }
  function handleSetToDate(v) { setToDate(v); setPage(1) }
  function handleClearFilters() { setSearch(''); setVisibility(''); setFromDate(''); setToDate(''); setPage(1) }

  return (
    <DashboardLayout title="Q&A Boards" subtitle="Browse and join Q&A boards">
      <Stack gap={4} className="max-w-5xl">

        {/* Search + filter bar */}
        <QnaFilters
          search={search} setSearch={handleSetSearch}
          visibility={visibility} setVisibility={handleSetVisibility}
          fromDate={fromDate} setFromDate={handleSetFromDate}
          toDate={toDate} setToDate={handleSetToDate}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={handleClearFilters}
          role="participant"
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
              <Surface key={i} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <Stack gap={2} className="flex-1">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-32" />
                  </Stack>
                  <Skeleton className="h-4 w-4 shrink-0 mt-0.5" />
                </div>
              </Surface>
            ))}
          </Stack>
        ) : posts.length === 0 ? (
          hasActiveFilters ? (
            <EmptyState
              heading="No boards found"
              description="Try adjusting your search or filters."
              action={{ label: 'Clear filters', onClick: handleClearFilters }}
            />
          ) : (
            <EmptyState
              heading="No Q&A boards available"
              description="Check back later for new boards."
            />
          )
        ) : (
          <>
            <Stack gap={2}>
              {posts.map((post) => (
                <Surface
                  as="button"
                  key={post.id}
                  onClick={() => navigate(`/user/qna/${post.id}`)}
                  className="w-full px-5 py-4 text-left shadow-sm hover:-translate-y-0.5 hover:shadow-md hover:border-blue-200 transition-all duration-200 group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors duration-200 truncate">
                          {post.title}
                        </span>
                        <VisibilityBadge visibility={post.visibility} />
                        <StatusBadge isClosed={post.status === 'CLOSED' || (post.end_at && new Date() >= new Date(post.end_at))} />
                      </div>
                      {post.description && (
                        <Text className="line-clamp-2 mb-1.5">{post.description}</Text>
                      )}
                      <Text size="xs" color="muted">
                        {post.question_count || 0} Question{post.question_count !== 1 ? 's' : ''}
                        <span className="mx-1.5">·</span>
                        {new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Text>
                    </div>
                    <svg className="w-4 h-4 text-slate-300 shrink-0 mt-0.5 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all duration-200" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
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
