import { useEffect, useState } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import axiosInstance from '../../api/axiosInstance'
import { StaggerList, StaggerItem } from '../../lib/motion'

function SkeletonBlock({ className }) {
  return <div className={`bg-slate-100 rounded-xl animate-pulse ${className}`} />
}

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

const ReplyIcon = (
  <svg fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
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
    <div className="bg-white border border-slate-200 rounded-2xl px-6 py-6 shadow-sm hover:shadow-md transition-all duration-200 group">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-[0.08em]">{label}</p>
          <div className="mt-3">
            {loading ? (
              <SkeletonBlock className="h-10 w-20" />
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
    </div>
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
          <span className="text-slate-400 font-medium">post{count !== 1 ? 's' : ''}</span>
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

function SectionHeader({ children }) {
  return (
    <h2 className="text-base font-bold text-slate-900 tracking-tight">{children}</h2>
  )
}

export default function AnalyticsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  function load() {
    setError(false)
    setLoading(true)
    axiosInstance.get('/admin/analytics')
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
        <div className="flex flex-col items-center justify-center py-28 text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mb-5">
            <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 8v4m0 4h.01" />
            </svg>
          </div>
          <p className="text-base font-bold text-slate-900">Failed to load analytics</p>
          <p className="text-sm text-slate-500 mt-1.5">Check your connection and try again.</p>
          <button
            onClick={load}
            className="mt-5 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors duration-200"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="max-w-5xl space-y-8">

          {/* KPI Cards */}
          <StaggerList className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <StaggerItem>
              <KpiCard label="Total Q&A Boards" value={data?.total_posts} icon={QnaIcon} color="blue" loading={loading} />
            </StaggerItem>
            <StaggerItem>
              <KpiCard label="Total Questions" value={data?.total_questions} icon={QuestionIcon} color="indigo" loading={loading} />
            </StaggerItem>
            <StaggerItem>
              <KpiCard label="Total Replies" value={data?.total_replies} icon={ReplyIcon} color="violet" loading={loading} />
            </StaggerItem>
          </StaggerList>

          {/* Visibility breakdown */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <SectionHeader>Visibility Breakdown</SectionHeader>
              {!loading && (
                <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
                  {totalPosts} total
                </span>
              )}
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl px-7 py-6 shadow-sm space-y-6">
              {loading ? (
                <>
                  <div className="space-y-2">
                    <SkeletonBlock className="h-4 w-40" />
                    <SkeletonBlock className="h-2.5 w-full" />
                  </div>
                  <div className="space-y-2">
                    <SkeletonBlock className="h-4 w-36" />
                    <SkeletonBlock className="h-2.5 w-full" />
                  </div>
                </>
              ) : (
                <>
                  <VisibilityBar label="Public" count={publicCount} pct={publicPct} variant="public" />
                  <VisibilityBar label="Private" count={privateCount} pct={privatePct} variant="private" />
                </>
              )}
            </div>
          </div>

          {/* Most active Q&A */}
          {(loading || (data?.most_active_topics?.length > 0)) && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <SectionHeader>Most Active Q&A</SectionHeader>
                {!loading && data?.most_active_topics?.length > 0 && (
                  <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
                    Top {data.most_active_topics.length}
                  </span>
                )}
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                {loading ? (
                  <div className="divide-y divide-slate-100">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="px-6 py-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 flex-1">
                          <SkeletonBlock className="h-6 w-6 rounded-lg" />
                          <SkeletonBlock className="h-4 w-48" />
                        </div>
                        <SkeletonBlock className="h-4 w-20" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <StaggerList className="divide-y divide-slate-100">
                    {data.most_active_topics.map((p, i) => (
                      <StaggerItem
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
                          <span className="text-xs text-slate-400 font-medium">
                            question{p.question_count !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </StaggerItem>
                    ))}
                  </StaggerList>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  )
}
