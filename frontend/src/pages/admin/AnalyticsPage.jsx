import { useEffect, useState } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import axiosInstance from '../../api/axiosInstance'

function Skeleton({ className }) {
  return <div className={`bg-muted rounded-md animate-pulse ${className}`} />
}

function StatCard({ label, value }) {
  return (
    <div className="bg-card border border-border rounded-xl px-6 py-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-3xl font-bold text-foreground mt-1">{value ?? '—'}</p>
    </div>
  )
}

function VisibilityRow({ label, count, pct, isPublic }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">
          {count} post{count !== 1 ? 's' : ''} &middot; {pct}%
        </span>
      </div>
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${isPublic ? 'bg-primary' : 'bg-muted-foreground'}`}
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

  useEffect(() => {
    axiosInstance.get('/admin/analytics')
      .then((res) => setData(res.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  const totalPosts = data?.total_posts ?? 0
  const publicCount = data?.visibility?.public ?? 0
  const privateCount = data?.visibility?.private ?? 0
  const publicPct = totalPosts > 0 ? Math.round((publicCount / totalPosts) * 100) : 0
  const privatePct = totalPosts > 0 ? 100 - publicPct : 0

  return (
    <DashboardLayout title="Analytics" subtitle="Content overview">
      {loading ? (
        <div className="space-y-8 max-w-3xl">
          <div className="grid grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-xl px-6 py-5 space-y-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-9 w-16" />
              </div>
            ))}
          </div>
          <div className="bg-card border border-border rounded-xl px-5 py-4 space-y-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-2 w-full" />
          </div>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <svg className="w-5 h-5 text-destructive" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 8v4m0 4h.01" />
            </svg>
          </div>
          <p className="text-sm font-medium text-foreground">Failed to load analytics</p>
          <p className="text-sm text-muted-foreground mt-1">Check your connection and try again.</p>
          <button
            onClick={() => { setError(false); setLoading(true); axiosInstance.get('/admin/analytics').then(r => setData(r.data)).catch(() => setError(true)).finally(() => setLoading(false)) }}
            className="mt-4 text-sm text-primary hover:underline"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-8 max-w-3xl">
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Total Q&A Posts" value={data?.total_posts} />
            <StatCard label="Total Questions" value={data?.total_questions} />
            <StatCard label="Total Replies" value={data?.total_replies} />
          </div>

          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3">Public vs Private</h2>
            <div className="bg-card border border-border rounded-xl px-5 py-4 space-y-4">
              <VisibilityRow label="Public" count={publicCount} pct={publicPct} isPublic={true} />
              <VisibilityRow label="Private" count={privateCount} pct={privatePct} isPublic={false} />
            </div>
          </div>

          {data?.most_active_topics?.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-3">Most Active Q&A Posts</h2>
              <div className="space-y-2">
                {data.most_active_topics.map((p, i) => (
                  <div
                    key={p.qna_id}
                    className="bg-card border border-border rounded-xl px-5 py-3 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs text-muted-foreground font-mono w-4 shrink-0">{i + 1}</span>
                      <span className="text-sm font-medium text-foreground truncate">{p.title}</span>
                    </div>
                    <span className="text-sm text-muted-foreground shrink-0">
                      {p.question_count} question{p.question_count !== 1 ? 's' : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  )
}
