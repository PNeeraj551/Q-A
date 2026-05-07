import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import DashboardLayout from '../../components/DashboardLayout'
import { getOverviewAnalytics } from '../../api/adminAnalytics'

const STATUS_LABELS = {
  SCHEDULED:      'Scheduled',
  PRE_SESSION:    'Pre-Session',
  ACTIVE_SESSION: 'Live',
  POST_SESSION:   'Completed',
  CLOSED:         'Ended',
}

const STATUS_COLORS = {
  SCHEDULED:      'bg-slate-100 text-slate-600',
  PRE_SESSION:    'bg-amber-50 text-amber-700',
  ACTIVE_SESSION: 'bg-emerald-50 text-emerald-700',
  POST_SESSION:   'bg-blue-50 text-blue-700',
  CLOSED:         'bg-slate-100 text-slate-500',
}

const ENGAGEMENT_COLORS = {
  Low:    'bg-slate-100 text-slate-600',
  Medium: 'bg-amber-50 text-amber-700',
  High:   'bg-emerald-50 text-emerald-700',
}

function MetricCard({ label, value, sub, icon }) {
  return (
    <div className="flex flex-col gap-1 bg-white rounded-xl border border-slate-100 px-5 py-4 shadow-sm">
      <div className="flex items-center gap-2 mb-0.5">
        {icon && <span className="text-slate-400">{icon}</span>}
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</span>
      </div>
      <span className="text-2xl font-bold text-slate-900 leading-tight">
        {value != null ? value : <span className="text-slate-300">—</span>}
      </span>
      {sub && <span className="text-xs text-slate-400">{sub}</span>}
    </div>
  )
}

const TooltipArea = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-slate-600 mb-1">{label}</p>
      <p className="text-indigo-600 font-bold">{payload[0].value} events</p>
    </div>
  )
}

const TooltipBar = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-slate-600 mb-1">{label}</p>
      <p className="text-violet-600 font-bold">{payload[0].value} sessions</p>
    </div>
  )
}

const ANALYTICS_ELIGIBLE = ['POST_SESSION', 'CLOSED']

export default function AnalyticsDashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')

  useEffect(() => {
    setLoading(true)
    getOverviewAnalytics()
      .then(res => { setData(res.data); setFetchError('') })
      .catch(() => setFetchError('Failed to load analytics.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <DashboardLayout title="Analytics" subtitle="Aggregated session engagement overview">
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">

        {loading && (
          <div className="flex justify-center items-center py-24">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && fetchError && (
          <div className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            {fetchError}
          </div>
        )}

        {!loading && data && (
          <>
            {/* Metric cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <MetricCard
                label="Total Sessions"
                value={data.totalSessions}
                sub="all time"
                icon={
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                }
              />
              <MetricCard
                label="Sessions This Week"
                value={data.sessionsThisWeek}
                sub="last 7 days"
                icon={
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
              />
              <MetricCard
                label="Participants Active"
                value={data.participantsActive}
                sub="across all sessions"
                icon={
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                }
              />
              <div className="flex flex-col gap-1 bg-white rounded-xl border border-slate-100 px-5 py-4 shadow-sm">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Avg Engagement</span>
                </div>
                {data.avgEngagement ? (
                  <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full w-fit ${ENGAGEMENT_COLORS[data.avgEngagement]}`}>
                    {data.avgEngagement}
                  </span>
                ) : (
                  <span className="text-slate-300 text-2xl font-bold">—</span>
                )}
                <span className="text-xs text-slate-400">completed sessions</span>
              </div>
              <div className="flex flex-col gap-1 bg-white rounded-xl border border-slate-100 px-5 py-4 shadow-sm col-span-2 sm:col-span-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Most Active</span>
                {data.mostActiveSession ? (
                  <>
                    <span className="text-sm font-bold text-slate-900 leading-tight line-clamp-2">{data.mostActiveSession.title}</span>
                    <span className="text-xs text-slate-400">{data.mostActiveSession.count} questions</span>
                  </>
                ) : (
                  <span className="text-slate-300 text-2xl font-bold">—</span>
                )}
              </div>
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Engagement Trend */}
              <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-0.5">Engagement Trend</p>
                <p className="text-[10px] text-slate-400 mb-4">All interactions · last 8 weeks</p>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={data.engagementTrend} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <defs>
                      <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip content={<TooltipArea />} />
                    <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} fill="url(#trendGrad)" dot={false} activeDot={{ r: 4, fill: '#6366f1', strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Session Status Distribution */}
              <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-0.5">Session Status</p>
                <p className="text-[10px] text-slate-400 mb-4">Count by current status</p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={data.sessionStatusData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <defs>
                      <linearGradient id="statusGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.85} />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.4} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="status" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={(v) => STATUS_LABELS[v] || v} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip content={<TooltipBar />} />
                    <Bar dataKey="count" fill="url(#statusGrad)" radius={[3, 3, 0, 0]} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Sessions table */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">Sessions</p>
                <span className="text-[10px] text-slate-400">{data.sessionsTable.length} shown</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-50">
                      <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-5 py-3">Title</th>
                      <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-3">Date</th>
                      <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-3">Status</th>
                      <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-3">Engagement</th>
                      <th className="text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider px-5 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sessionsTable.map(row => (
                      <tr key={row._id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3 font-medium text-slate-800 max-w-xs">
                          <span className="line-clamp-1">{row.title}</span>
                        </td>
                        <td className="px-3 py-3 text-slate-500 whitespace-nowrap text-xs">
                          {new Date(row.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[row.status] || 'bg-slate-100 text-slate-500'}`}>
                            {row.status === 'ACTIVE_SESSION' && (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            )}
                            {STATUS_LABELS[row.status] || row.status}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          {row.engagement ? (
                            <span className={`inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full ${ENGAGEMENT_COLORS[row.engagement]}`}>
                              {row.engagement}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {ANALYTICS_ELIGIBLE.includes(row.status) ? (
                            <button
                              onClick={() => navigate(`/admin/analytics/${row._id}`)}
                              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline transition-colors"
                            >
                              View Analytics
                            </button>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {data.sessionsTable.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center text-slate-400 text-sm py-10">
                          No sessions found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-[10px] text-slate-300 text-center">
              Interaction data is aggregated across all sessions.
            </p>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
