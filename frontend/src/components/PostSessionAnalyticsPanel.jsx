import { useEffect, useState } from 'react'
import {
  AreaChart, Area,
  BarChart, Bar,
  XAxis, YAxis,
  CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { getPostSessionAnalytics } from '../api/adminAnalytics'

function fmtTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })
}

function fmtTimeline(data = []) {
  return data.map(d => ({ ...d, time: fmtTime(d.time) }))
}

const LEVEL_CONFIG = {
  Low:    { className: 'bg-slate-100 text-slate-600 border-slate-200',     dot: 'bg-slate-400' },
  Medium: { className: 'bg-amber-50 text-amber-700 border-amber-200',      dot: 'bg-amber-500' },
  High:   { className: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
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

const CustomTooltipArea = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-slate-600 mb-1">{label}</p>
      <p className="text-indigo-600 font-bold">{payload[0].value} events</p>
    </div>
  )
}

const CustomTooltipBar = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-slate-600 mb-1">{label}</p>
      <p className="text-violet-600 font-bold">{payload[0].value} interactions</p>
    </div>
  )
}

export default function PostSessionAnalyticsPanel({ sessionId, sessionStatus }) {
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')

  const isEligible = ['POST_SESSION', 'CLOSED'].includes(sessionStatus)

  useEffect(() => {
    if (!isEligible || !sessionId) return
    setLoading(true)
    getPostSessionAnalytics(sessionId)
      .then(res => { setAnalytics(res.data); setFetchError('') })
      .catch(err => setFetchError(err.response?.data?.error || 'Failed to load analytics.'))
      .finally(() => setLoading(false))
  }, [sessionId, isEligible])

  if (!isEligible) return null

  const level = analytics?.engagement_level ?? 'Low'
  const levelConfig = LEVEL_CONFIG[level] ?? LEVEL_CONFIG.Low

  const hasTimeline = analytics?.timeline?.some(t => t.activity > 0)
  const hasCollab = analytics?.anonymous_collaboration_activity?.some(t => t.count > 0)

  // Thin timeline data: show every other tick label to prevent crowding
  const timelineData = fmtTimeline(analytics?.timeline)
  const collabData = fmtTimeline(analytics?.anonymous_collaboration_activity)

  return (
    <div className="bg-gradient-to-b from-slate-50 to-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900">Session Engagement Analytics</h3>
          <p className="text-xs text-slate-400 mt-0.5">Anonymous aggregated data · No participant identities</p>
        </div>
        {!loading && analytics && (
          <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border ${levelConfig.className}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${levelConfig.dot}`} />
            {level} Engagement
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-6">
        {loading && (
          <div className="flex justify-center items-center py-16">
            <div className="w-6 h-6 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && fetchError && (
          <div className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            {fetchError}
          </div>
        )}

        {!loading && analytics && (
          <div className="space-y-6">
            {/* Metric cards row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <MetricCard
                label="Active Participants"
                value={analytics.participants_active}
                sub="engaged at least once"
                icon={
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                }
              />
              <MetricCard
                label="Peak Activity"
                value={fmtTime(analytics.peak_activity_time)}
                sub="highest engagement window"
                icon={
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                }
              />
              <MetricCard
                label="Public Questions"
                value={analytics.public_questions_count}
                sub="total submitted"
                icon={
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                }
              />
            </div>

            {/* Engagement Timeline */}
            <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">Engagement Timeline</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Total anonymous activity · 5-minute intervals</p>
                </div>
              </div>
              {!hasTimeline ? (
                <p className="text-xs text-slate-400 text-center py-8">No activity recorded for this session.</p>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={timelineData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <defs>
                      <linearGradient id="timelineGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip content={<CustomTooltipArea />} />
                    <Area
                      type="monotone"
                      dataKey="activity"
                      stroke="#6366f1"
                      strokeWidth={2}
                      fill="url(#timelineGrad)"
                      dot={false}
                      activeDot={{ r: 4, fill: '#6366f1', strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Anonymous Collaboration Activity */}
            <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
              <div className="mb-4">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">Anonymous Collaboration Activity</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Aggregated private interaction events · No identities exposed</p>
              </div>
              {!hasCollab ? (
                <p className="text-xs text-slate-400 text-center py-8">No collaboration activity recorded.</p>
              ) : (
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={collabData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <defs>
                      <linearGradient id="collabGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="#8b5cf6" stopOpacity={0.85} />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.4} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip content={<CustomTooltipBar />} />
                    <Bar
                      dataKey="count"
                      fill="url(#collabGrad)"
                      radius={[3, 3, 0, 0]}
                      maxBarSize={24}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
              <p className="text-[10px] text-slate-300 mt-3 text-center">
                Collaboration counts are anonymous aggregates. No participant mapping is stored.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
