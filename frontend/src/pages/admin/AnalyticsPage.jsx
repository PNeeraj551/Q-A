import { useEffect, useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import axiosInstance from '../../api/axiosInstance'
import { PageError } from '@/components/common/PageError'
import { Skeleton } from '@/components/common/Skeleton'
import { Surface } from '@/components/common/Surface'
import { Stack } from '@/components/common/Stack'
import { Heading } from '@/components/common/Heading'
import { Text } from '@/components/common/Text'

const QnaIcon = (
  <svg fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
)

const QuestionIcon = (
  <svg fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)


function KpiCard({ label, value, icon, color, loading }) {
  const colorMap = {
    blue: {
      bg: 'bg-blue-50',
      icon: 'text-blue-600',
      ring: 'ring-blue-100',
    },
    indigo: {
      bg: 'bg-indigo-50',
      icon: 'text-indigo-600',
      ring: 'ring-indigo-100',
    },
    violet: {
      bg: 'bg-violet-50',
      icon: 'text-violet-600',
      ring: 'ring-violet-100',
    },
  }
  const c = colorMap[color] || colorMap.blue

  return (
    <Surface className="px-6 py-6 shadow-sm hover:shadow-md transition-all duration-200 group">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-600 tracking-wider">{label}</p>
          <div className="mt-3">
            {loading ? (
              <Skeleton className="h-10 w-20" />
            ) : (
              <p className="text-4xl font-bold text-slate-900 tracking-tight tabular-nums">
                {value ?? '—'}
              </p>
            )}
          </div>
        </div>
        <div className={`w-11 h-11 rounded-2xl ${c.bg} ${c.icon} flex items-center justify-center shrink-0 ring-4 ${c.ring} group-hover:scale-105 transition-transform duration-200`}>
          {icon}
        </div>
      </div>
    </Surface>
  )
}

function VisibilityBar({ label, count, pct, variant }) {
  const isPublic = variant === 'public'
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`w-2.5 h-2.5 rounded-full ${isPublic ? 'bg-blue-600' : 'bg-slate-400'}`} />
          <span className="text-sm font-semibold text-slate-800">{label}</span>
        </div>
        <div className="flex items-center gap-2.5 text-sm">
          <span className="font-semibold text-slate-900 tabular-nums">{count}</span>
          <span className="text-slate-400 font-medium">Board{count !== 1 ? 's' : ''}</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${isPublic ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
            {pct}%
          </span>
        </div>
      </div>
      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${isPublic ? 'bg-gradient-to-r from-blue-600 to-indigo-500' : 'bg-gradient-to-r from-slate-400 to-slate-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  function load() {
    setError(false)
    setLoading(true)
    axiosInstance.get('/qna/analytics')
      .then((res) => setData(res.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const totalPosts = data?.total_posts ?? 0
  const publicCount = data?.visibility?.public ?? 0
  const privateCount = data?.visibility?.private ?? 0
  const publicPct = totalPosts > 0 ? Math.round((publicCount / totalPosts) * 100) : 0
  const privatePct = totalPosts > 0 ? 100 - publicPct : 0

  return (
    <DashboardLayout title="Analytics" subtitle="Platform usage and content overview">
      {error ? (
        <PageError heading="Failed to load analytics" action={{ label: 'Retry', onClick: load }} />
      ) : (
        <Stack gap={8} className="max-w-5xl">

          {/* KPI Surfaces */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <KpiCard label="Total Q&A Boards" value={data?.total_posts} icon={QnaIcon} color="blue" loading={loading} />
            <KpiCard label="Total Questions" value={data?.total_questions} icon={QuestionIcon} color="indigo" loading={loading} />
          </div>

          {/* Visibility breakdown */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <Heading level={2}>Visibility Breakdown</Heading>
              {!loading && (
                <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
                  {totalPosts} total
                </span>
              )}
            </div>
            <Surface className="px-7 py-6 shadow-sm"><Stack gap={6}>
              {loading ? (
                <>
                  <Stack gap={2}>
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-2.5 w-full" />
                  </Stack>
                  <Stack gap={2}>
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-2.5 w-full" />
                  </Stack>
                </>
              ) : (
                <>
                  <VisibilityBar label="Public" count={publicCount} pct={publicPct} variant="public" />
                  <VisibilityBar label="Private" count={privateCount} pct={privatePct} variant="private" />
                </>
              )}
            </Stack></Surface>
          </div>

          {/* Most active Q&A */}
          {(loading || (data?.most_active_topics?.length > 0)) && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <Heading level={2}>Most Active Q&A Boards</Heading>
                {!loading && data?.most_active_topics?.length > 0 && (
                  <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
                    Top {data.most_active_topics.length}
                  </span>
                )}
              </div>
              <Surface className="shadow-sm overflow-hidden">
                {loading ? (
                  <div className="divide-y divide-slate-100">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="px-6 py-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 flex-1">
                          <Skeleton className="h-6 w-6 rounded-lg" />
                          <Skeleton className="h-4 w-48" />
                        </div>
                        <Skeleton className="h-4 w-20" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {data.most_active_topics.map((p, i) => (
                      <div
                        key={p.qna_id}
                        className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors duration-200"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                            i === 0 ? 'bg-blue-100 text-blue-700' :
                            i === 1 ? 'bg-indigo-50 text-indigo-600' :
                            i === 2 ? 'bg-violet-50 text-violet-600' :
                            'bg-slate-100 text-slate-500'
                          }`}>
                            {i + 1}
                          </div>
                          <span className="text-sm font-semibold text-slate-900 truncate">{p.title}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-bold text-slate-900 tabular-nums">{p.question_count}</span>
                          <Text as="span" size="xs" color="muted" className="font-medium">
                            Question{p.question_count !== 1 ? 's' : ''}
                          </Text>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Surface>
            </div>
          )}
        </Stack>
      )}
    </DashboardLayout>
  )
}
