import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import DashboardLayout from '../../components/DashboardLayout'
import { getSessionDetailAnalytics } from '../../api/adminAnalytics'

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

const TooltipArea = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-slate-600 mb-1">{label}</p>
      <p className="text-indigo-600 font-bold">{payload[0].value} events</p>
    </div>
  )
}

const TooltipQuestion = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-slate-600 mb-1">{label}</p>
      <p className="text-sky-600 font-bold">{payload[0].value} questions</p>
    </div>
  )
}

const TooltipCollab = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-slate-600 mb-1">{label}</p>
      <p className="text-violet-600 font-bold">{payload[0].value} interactions</p>
    </div>
  )
}

export default function SessionAnalyticsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getSessionDetailAnalytics(id)
      .then(res => { setData(res.data); setFetchError('') })
      .catch(() => setFetchError('Failed to load session analytics.'))
      .finally(() => setLoading(false))
  }, [id])

  const level = data?.engagement_level ?? 'Low'
  const levelConfig = LEVEL_CONFIG[level] ?? LEVEL_CONFIG.Low

  const hasTimeline = data?.timeline?.some(t => t.activity > 0)
  const hasQuestions = data?.question_timeline?.some(t => t.activity > 0)
  const hasCollab = data?.anonymous_collaboration_activity?.some(t => t.count > 0)

  return (
    <DashboardLayout title="Session Analytics" subtitle="Post-session engagement breakdown">
      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">

        {/* Back button */}
        <button
          onClick={() => navigate('/admin/analytics')}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Analytics
        </button>

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

        {!loading && data && !data.available && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center">
              <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <p className="text-slate-600 font-medium text-center">{data.message}</p>
            <button
              onClick={() => navigate('/admin/analytics')}
              className="text-xs font-medium text-indigo-600 hover:underline"
            >
              Return to Overview
            </button>
          </div>
        )}

        {!loading && data?.available && (
          <>
            {/* Metric cards */}
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-600">Session ID: <span className="font-mono text-slate-400 text-xs">{id}</span></h2>
              <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border ${levelConfig.className}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${levelConfig.dot}`} />
                {level} Engagement
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MetricCard
                label="Participants Active"
                value={data.participants_active}
                sub="engaged at least once"
                icon={
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                }
              />
              <MetricCard
                label="Peak Activity"
                value={data.peak_activity_time ?? '—'}
                sub="highest engagement window"
                icon={
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                }
              />
              <MetricCard
                label="Engagement Level"
                value={data.engagement_level}
                sub="Low / Medium / High"
                icon={
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                }
              />
              <MetricCard
                label="Public Questions"
                value={data.public_questions_count}
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
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-0.5">Engagement Timeline</p>
              <p className="text-[10px] text-slate-400 mb-4">Total anonymous activity · 5-minute intervals</p>
              {!hasTimeline ? (
                <p className="text-xs text-slate-400 text-center py-8">No activity recorded for this session.</p>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={data.timeline} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <defs>
                      <linearGradient id="saTimelineGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip content={<TooltipArea />} />
                    <Area type="monotone" dataKey="activity" stroke="#6366f1" strokeWidth={2} fill="url(#saTimelineGrad)" dot={false} activeDot={{ r: 4, fill: '#6366f1', strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Public Question Volume */}
            <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-0.5">Public Question Volume</p>
              <p className="text-[10px] text-slate-400 mb-4">Questions submitted per 5-minute window</p>
              {!hasQuestions ? (
                <p className="text-xs text-slate-400 text-center py-8">No questions recorded for this session.</p>
              ) : (
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={data.question_timeline} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <defs>
                      <linearGradient id="saQuestionGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.85} />
                        <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.3} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip content={<TooltipQuestion />} />
                    <Bar dataKey="activity" fill="url(#saQuestionGrad)" radius={[3, 3, 0, 0]} maxBarSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Anonymous Collaboration Activity */}
            <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-0.5">Anonymous Collaboration Activity</p>
              <p className="text-[10px] text-slate-400 mb-4">Aggregated private interaction events · No identities exposed</p>
              {!hasCollab ? (
                <p className="text-xs text-slate-400 text-center py-8">No collaboration activity recorded.</p>
              ) : (
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={data.anonymous_collaboration_activity} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <defs>
                      <linearGradient id="saCollabGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.85} />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.4} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip content={<TooltipCollab />} />
                    <Bar dataKey="count" fill="url(#saCollabGrad)" radius={[3, 3, 0, 0]} maxBarSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              )}
              <p className="text-[10px] text-slate-300 mt-3 text-center">
                Collaboration counts are anonymous aggregates. No participant mapping is stored.
              </p>
            </div>

            <p className="text-[10px] text-slate-300 text-center pb-2">
              All data is anonymously aggregated. No participant identity is stored or displayed.
            </p>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
