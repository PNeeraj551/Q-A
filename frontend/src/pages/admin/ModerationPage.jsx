import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { getModerationSummary, getSuspiciousActivity, getAnonVotes, voidVoteById } from '../../api/moderation'

function StatCard({ label, value, icon }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 hover:shadow-sm transition-shadow duration-200">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2 leading-none">{label}</p>
          <p className="text-2xl font-bold text-slate-900 tabular-nums">{value ?? '—'}</p>
        </div>
        {icon && (
          <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-slate-300">{icon}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function SectionHeader({ title, onRefresh, loading }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-sm font-semibold text-slate-800 tracking-tight">{title}</h2>
      <button
        onClick={onRefresh}
        disabled={loading}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 disabled:opacity-40 transition-colors duration-150 px-2.5 py-1 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200"
      >
        {loading ? (
          <>
            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3V4A10 10 0 002 12h2z" />
            </svg>
            Loading…
          </>
        ) : (
          <>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Refresh
          </>
        )}
      </button>
    </div>
  )
}

function EmptyState({ message, detail }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-2.5">
      <svg className="w-9 h-9 text-slate-200" fill="none" stroke="currentColor" strokeWidth="1.25" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
      <p className="text-sm text-slate-400 font-medium">{message}</p>
      {detail && <p className="text-xs text-slate-300 text-center max-w-xs leading-relaxed">{detail}</p>}
    </div>
  )
}

function InlineEmpty({ message }) {
  return (
    <div className="flex items-center gap-2 py-2">
      <svg className="w-3.5 h-3.5 text-slate-300 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>
      <p className="text-xs text-slate-400">{message}</p>
    </div>
  )
}

const VoteIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V2.75a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23H5.904m10.598-9.75H14.25M5.904 18.5c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 0 1-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 9.953 4.167 9.5 5 9.5h1.053c.472 0 .745.556.5.96a8.958 8.958 0 0 0-1.302 4.665c0 1.194.232 2.333.654 3.375Z" />
  </svg>
)
const DeviceIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
  </svg>
)
const IpIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
  </svg>
)
const ClockIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

export default function ModerationPage() {
  const [summary, setSummary] = useState(null)
  const [suspicious, setSuspicious] = useState(null)
  const [votes, setVotes] = useState([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loadingSuspicious, setLoadingSuspicious] = useState(false)
  const [loadingVotes, setLoadingVotes] = useState(false)
  const [voidingId, setVoidingId] = useState(null)
  const LIMIT = 50

  useEffect(() => {
    getModerationSummary().then((r) => setSummary(r.data)).catch(() => {})
  }, [])

  const loadSuspicious = useCallback(() => {
    setLoadingSuspicious(true)
    getSuspiciousActivity()
      .then((r) => setSuspicious(r.data))
      .catch(() => toast.error('Failed to load suspicious activity'))
      .finally(() => setLoadingSuspicious(false))
  }, [])

  const loadVotes = useCallback((off = 0) => {
    setLoadingVotes(true)
    getAnonVotes({ limit: LIMIT, offset: off })
      .then((r) => {
        setVotes(r.data.votes)
        setTotal(r.data.total)
        setOffset(off)
      })
      .catch(() => toast.error('Failed to load votes'))
      .finally(() => setLoadingVotes(false))
  }, [])

  useEffect(() => { loadVotes(0) }, [loadVotes])

  async function handleVoid(id) {
    if (!window.confirm('Remove this vote from the record?')) return
    setVoidingId(id)
    try {
      await voidVoteById(id)
      toast.success('Vote removed.')
      loadVotes(offset)
      getModerationSummary().then((r) => setSummary(r.data)).catch(() => {})
    } catch {
      toast.error('Failed to remove vote.')
    } finally {
      setVoidingId(null)
    }
  }

  return (
    <DashboardLayout title="Integrity" subtitle="Anonymous vote trust and audit visibility">

      {/* ── Summary metrics ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Anon Votes"  value={summary?.totalVotes}    icon={VoteIcon} />
        <StatCard label="Unique Devices"    value={summary?.uniqueTokens}  icon={DeviceIcon} />
        <StatCard label="Unique IP Hashes"  value={summary?.uniqueIpHashes} icon={IpIcon} />
        <StatCard label="Votes (24h)"       value={summary?.last24hVotes}  icon={ClockIcon} />
      </div>

      {/* ── Suspicious activity ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-5">
        <SectionHeader title="Suspicious Activity" onRefresh={loadSuspicious} loading={loadingSuspicious} />

        {!suspicious && !loadingSuspicious && (
          <div className="flex items-center gap-2.5 py-2">
            <svg className="w-3.5 h-3.5 text-slate-300 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
            <p className="text-xs text-slate-400">Run a scan to check for anomalies.</p>
          </div>
        )}

        {suspicious && (
          <div className="space-y-6">

            {/* IPs with many tokens */}
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2.5">
                IPs with many device tokens <span className="normal-case font-normal text-slate-300">(threshold: &gt;5)</span>
              </p>
              {suspicious.suspiciousIps.length === 0 ? (
                <InlineEmpty message="No anomalies detected." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left border-b border-slate-100">
                        <th className="pb-2 font-semibold text-slate-400 text-[11px] uppercase tracking-wider">IP hash prefix</th>
                        <th className="pb-2 font-semibold text-slate-400 text-[11px] uppercase tracking-wider">Device tokens</th>
                      </tr>
                    </thead>
                    <tbody>
                      {suspicious.suspiciousIps.map((row, i) => (
                        <tr
                          key={i}
                          className={`border-b border-slate-50 hover:bg-slate-50 transition-colors duration-100 ${row.token_count > 10 ? 'bg-amber-50/70' : ''}`}
                        >
                          <td className="py-2 font-mono text-[11px] text-slate-600 tracking-tight">{row.ip_hash.slice(0, 12)}…</td>
                          <td className={`py-2 tabular-nums font-semibold ${row.token_count > 10 ? 'text-amber-700' : 'text-slate-700'}`}>
                            {row.token_count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="border-t border-slate-100" />

            {/* High-velocity tokens */}
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2.5">
                High-velocity devices <span className="normal-case font-normal text-slate-300">(threshold: &gt;15 votes/hr)</span>
              </p>
              {suspicious.velocityAnomalies.length === 0 ? (
                <InlineEmpty message="No anomalies detected." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left border-b border-slate-100">
                        <th className="pb-2 font-semibold text-slate-400 text-[11px] uppercase tracking-wider">Token prefix</th>
                        <th className="pb-2 font-semibold text-slate-400 text-[11px] uppercase tracking-wider">Votes last hour</th>
                      </tr>
                    </thead>
                    <tbody>
                      {suspicious.velocityAnomalies.map((row, i) => (
                        <tr
                          key={i}
                          className={`border-b border-slate-50 hover:bg-slate-50 transition-colors duration-100 ${row.votes_last_hour > 20 ? 'bg-amber-50/70' : ''}`}
                        >
                          <td className="py-2 font-mono text-[11px] text-slate-600 tracking-tight">{row.device_token}</td>
                          <td className={`py-2 tabular-nums font-semibold ${row.votes_last_hour > 20 ? 'text-amber-700' : 'text-slate-700'}`}>
                            {row.votes_last_hour}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="border-t border-slate-100" />

            {/* Shared user-agents */}
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2.5">
                User-agents shared across many devices <span className="normal-case font-normal text-slate-300">(threshold: &gt;10)</span>
              </p>
              {suspicious.sharedAgents.length === 0 ? (
                <InlineEmpty message="No anomalies detected." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left border-b border-slate-100">
                        <th className="pb-2 font-semibold text-slate-400 text-[11px] uppercase tracking-wider">User-agent</th>
                        <th className="pb-2 font-semibold text-slate-400 text-[11px] uppercase tracking-wider">Devices</th>
                      </tr>
                    </thead>
                    <tbody>
                      {suspicious.sharedAgents.map((row, i) => (
                        <tr
                          key={i}
                          className={`border-b border-slate-50 hover:bg-slate-50 transition-colors duration-100 ${row.token_count > 15 ? 'bg-amber-50/70' : ''}`}
                        >
                          <td className="py-2 text-slate-600 truncate max-w-xs">{row.user_agent}</td>
                          <td className={`py-2 tabular-nums font-semibold ${row.token_count > 15 ? 'text-amber-700' : 'text-slate-700'}`}>
                            {row.token_count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {/* ── Vote audit log ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <SectionHeader
          title={`Vote Audit Log${total > 0 ? ` — ${total.toLocaleString()} records` : ''}`}
          onRefresh={() => loadVotes(offset)}
          loading={loadingVotes}
        />

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left border-b border-slate-100">
                <th className="pb-2 font-semibold text-slate-400 text-[11px] uppercase tracking-wider">Time</th>
                <th className="pb-2 font-semibold text-slate-400 text-[11px] uppercase tracking-wider">Token prefix</th>
                <th className="pb-2 font-semibold text-slate-400 text-[11px] uppercase tracking-wider">IP hash prefix</th>
                <th className="pb-2 font-semibold text-slate-400 text-[11px] uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody>
              {votes.map((v) => (
                <tr key={v.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors duration-100">
                  <td className="py-2 text-slate-500 whitespace-nowrap">{new Date(v.created_at).toLocaleString()}</td>
                  <td className="py-2">
                    <span className="font-mono text-[11px] text-slate-600 tracking-tight bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded">
                      {v.device_token || '—'}
                    </span>
                  </td>
                  <td className="py-2">
                    <span className="font-mono text-[11px] text-slate-500 tracking-tight bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded">
                      {v.ip_hash || '—'}
                    </span>
                  </td>
                  <td className="py-2">
                    <button
                      onClick={() => handleVoid(v.id)}
                      disabled={!!voidingId}
                      className="text-[11px] font-semibold text-slate-400 hover:text-red-600 disabled:opacity-40 transition-colors duration-150 px-2 py-0.5 rounded hover:bg-red-50"
                    >
                      {voidingId === v.id ? 'Removing…' : 'Void'}
                    </button>
                  </td>
                </tr>
              ))}

              {votes.length === 0 && !loadingVotes && (
                <tr>
                  <td colSpan={4}>
                    <EmptyState
                      message="No vote records found."
                      detail="Anonymous votes will appear here as activity occurs on active boards."
                    />
                  </td>
                </tr>
              )}

              {loadingVotes && votes.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-xs text-slate-400">Loading…</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 0 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
            <button
              onClick={() => loadVotes(Math.max(0, offset - LIMIT))}
              disabled={offset === 0 || loadingVotes}
              className="text-xs font-medium text-slate-500 hover:text-slate-800 disabled:opacity-30 transition-colors duration-150 px-3 py-1.5 rounded-lg hover:bg-slate-50 disabled:hover:bg-transparent"
            >
              ← Previous
            </button>
            <span className="text-xs text-slate-400 tabular-nums">
              {offset + 1}–{Math.min(offset + LIMIT, total)} of {total.toLocaleString()}
            </span>
            <button
              onClick={() => loadVotes(offset + LIMIT)}
              disabled={offset + LIMIT >= total || loadingVotes}
              className="text-xs font-medium text-slate-500 hover:text-slate-800 disabled:opacity-30 transition-colors duration-150 px-3 py-1.5 rounded-lg hover:bg-slate-50 disabled:hover:bg-transparent"
            >
              Next →
            </button>
          </div>
        )}
      </div>

    </DashboardLayout>
  )
}
