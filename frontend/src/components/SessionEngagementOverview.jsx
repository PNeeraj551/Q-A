import { useEffect, useState, useCallback, useRef } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import axiosInstance from '@/api/axiosInstance'

function fmtTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })
}

function fmtTimeline(data = []) {
  return data.map(d => ({ ...d, time: fmtTime(d.time) }))
}

const INTENSITY_CONFIG = {
  LOW:    { label: 'LOW',    className: 'bg-gray-100 text-gray-500 border-gray-200' },
  MEDIUM: { label: 'MEDIUM', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  HIGH:   { label: 'HIGH',   className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
}

function MetricCard({ label, value, sub }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
      <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-semibold text-gray-900 leading-tight">
        {value != null ? value : <span className="text-gray-300">—</span>}
      </span>
      {sub && <span className="text-xs text-gray-400 mt-0.5">{sub}</span>}
    </div>
  )
}

export default function SessionEngagementOverview({ sessionId, socket }) {
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const intervalRef = useRef(null)

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await axiosInstance.get(`/sessions/${sessionId}/analytics`)
      setAnalytics(res.data)
      setFetchError('')
    } catch (err) {
      setFetchError(err.response?.data?.error || 'Failed to load analytics.')
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    fetchAnalytics()
    intervalRef.current = setInterval(fetchAnalytics, 30_000)
    return () => clearInterval(intervalRef.current)
  }, [fetchAnalytics])

  useEffect(() => {
    if (!socket) return
    socket.on('analytics:activity', fetchAnalytics)
    return () => socket.off('analytics:activity', fetchAnalytics)
  }, [socket, fetchAnalytics])

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <div className="w-5 h-5 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
        {fetchError}
      </div>
    )
  }

  const intensity = analytics?.activity_intensity ?? 'LOW'
  const intensityConfig = INTENSITY_CONFIG[intensity] ?? INTENSITY_CONFIG.LOW

  return (
    <Card className="rounded-xl border border-gray-100 bg-gradient-to-b from-white to-slate-50 shadow-sm">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-gray-700">
            Session Engagement Overview
          </CardTitle>
          <span
            className={`inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full border ${intensityConfig.className}`}
          >
            {intensityConfig.label}
          </span>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 px-4 pb-4">
        <div className="grid grid-cols-2 gap-2">
          <MetricCard label="Public Questions" value={analytics?.public_questions_count} />
          <MetricCard label="Participants Active" value={analytics?.participants_active} sub="last 10 min" />
          <MetricCard label="Participants Idle" value={analytics?.participants_idle} />
          <MetricCard label="Peak Activity" value={fmtTime(analytics?.peak_activity_time)} />
        </div>

        {analytics?.engagement_timeline?.length > 0 && (
          <div>
            <p className="text-xs text-gray-400 mb-2 font-medium tracking-wide uppercase">
              Activity Timeline
            </p>
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart
                data={fmtTimeline(analytics.engagement_timeline)}
                margin={{ top: 4, right: 4, left: -28, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="engagementGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25} />
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
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    background: '#fff',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  }}
                  formatter={(value) => [value, 'Events']}
                  labelStyle={{ color: '#64748b', fontWeight: 500 }}
                />
                <Area
                  type="monotone"
                  dataKey="events"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#engagementGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#6366f1', strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
