import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import { SOCKET_URL } from '../../lib/socket'
import DashboardLayout from '@/layouts/DashboardLayout'
import { listQna } from '../../api/qna'
import { useDebounce } from '../../hooks/useDebounce'
import { VisibilityBadge } from '@/components/Badges'
import { Pagination } from '@/components/qna/Pagination'
import { EmptyState } from '@/components/feedback/EmptyState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { SearchInput } from '@/components/qna/SearchInput'
import { Surface } from '@/components/Surface'
import { Stack } from '@/components/Stack'
import { Text } from '@/components/Text'

const LIMIT = 10

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
    <DashboardLayout title="Q&A Boards" subtitle="Browse and join Q&A boards">
      <Stack gap={4} className="max-w-3xl">

        {/* Search bar */}
        <SearchInput
          value={search}
          onChange={handleSearchChange}
          placeholder="Search boards..."
        />

        {/* Results count */}
        {!loading && (
          <Text size="xs" color="muted">
            {total === 0 ? 'No results' : `${total} board${total !== 1 ? 's' : ''}`}
            {search ? ' matching your search' : ''}
          </Text>
        )}

        {/* List */}
        {loading ? (
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
          search ? (
            <EmptyState
              heading="No boards found"
              description="Try a different search term."
              action={{ label: 'Clear search', onClick: () => { setSearch(''); setPage(1) } }}
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
                  key={post._id}
                  onClick={() => navigate(`/user/qna/${post._id}`)}
                  className="w-full px-5 py-4 text-left shadow-sm hover:-translate-y-0.5 hover:shadow-md hover:border-blue-200 transition-all duration-200 group"
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
