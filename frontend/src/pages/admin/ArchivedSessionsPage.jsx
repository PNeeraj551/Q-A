import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchArchivedSessions } from '../../api/archive';
import DashboardLayout from '../../components/DashboardLayout';
import { Input } from '@/components/ui/input';

export default function ArchivedSessionsPage() {
  const navigate = useNavigate();

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [filters, setFilters] = useState({
    title: '',
    from: '',
    to: '',
    access_type: 'All',
    participant: ''
  });
  
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1
  });

  const fetchArchives = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit
      };
      
      if (filters.title.trim()) params.title = filters.title.trim();
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;
      if (filters.access_type && filters.access_type !== 'All') params.access_type = filters.access_type;
      if (filters.participant.trim()) params.participant = filters.participant.trim();

      const res = await searchArchivedSessions(params);
      
      setSessions(res.data.sessions || []);
      setPagination(prev => ({
        ...prev,
        total: res.data.total || 0,
        totalPages: res.data.totalPages || 1
      }));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch archived sessions.');
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, pagination.limit]);

  useEffect(() => {
    fetchArchives();
  }, [fetchArchives]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleClearFilters = () => {
    setFilters({
      title: '',
      from: '',
      to: '',
      access_type: 'All',
      participant: ''
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const hasActiveFilters = filters.title || filters.from || filters.to || filters.participant || filters.access_type !== 'All';

  const filterBar = (
    <div className="bg-card rounded-2xl border border-border shadow-sm mb-6 overflow-hidden">
      <div className="p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="M21 21l-4.35-4.35" />
          </svg>
          <Input
            type="text"
            value={filters.title}
            onChange={e => handleFilterChange('title', e.target.value)}
            placeholder="Search by title..."
            className="pl-9 h-10 rounded-xl"
          />
        </div>

        <div className="relative flex-1 min-w-[180px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <Input
            type="text"
            value={filters.participant}
            onChange={e => handleFilterChange('participant', e.target.value)}
            placeholder="Participant name..."
            className="pl-9 h-10 rounded-xl"
          />
        </div>

        <select
          value={filters.access_type}
          onChange={e => handleFilterChange('access_type', e.target.value)}
          className="pl-3 pr-8 py-2 text-xs font-medium border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-muted/30 focus:bg-card transition h-10"
        >
          <option value="All">All Types</option>
          <option value="PUBLIC">Public</option>
          <option value="PRIVATE">Private</option>
        </select>

        <div className="flex items-center gap-2 bg-muted/30 border border-border rounded-xl px-2 h-10">
          <input
            type="date"
            value={filters.from}
            onChange={e => handleFilterChange('from', e.target.value)}
            className="bg-transparent text-xs font-medium focus:outline-none w-32"
          />
          <span className="text-[10px] text-muted-foreground font-bold uppercase">to</span>
          <input
            type="date"
            value={filters.to}
            onChange={e => handleFilterChange('to', e.target.value)}
            className="bg-transparent text-xs font-medium focus:outline-none w-32"
          />
        </div>

        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="text-xs font-bold text-muted-foreground hover:text-foreground px-4 h-10 rounded-xl border border-border hover:bg-muted transition-all uppercase tracking-tight"
          >
            Clear Filters
          </button>
        )}
      </div>
    </div>
  );

  return (
    <DashboardLayout
      title="Archived Sessions"
      subtitle={`${pagination.total} total sessions`}
    >
      {filterBar}

      {loading ? (
        <div className="flex justify-center py-24">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-600 flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 8v4m0 4h.01" />
          </svg>
          {error}
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-2xl border border-slate-200 border-dashed">
          <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-slate-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <p className="text-slate-500 text-sm font-medium">No archived sessions found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => {
            const isPrivate = session.access_type === 'PRIVATE';
            const startTime = new Date(session.planned_start_time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
            const date = new Date(session.planned_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

            return (
              <div
                key={session._id}
                className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex hover:shadow-md hover:border-primary/20 hover:-translate-y-px transition-all duration-200"
              >
                <div className="w-1 shrink-0 bg-muted" />

                <div className="flex-1 px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-foreground text-sm">{session.session_title}</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground ring-1 ring-border uppercase">
                        <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                        CLOSED
                      </span>
                      {isPrivate ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 uppercase">
                          PRIVATE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 ring-1 ring-sky-200 uppercase">
                          PUBLIC
                        </span>
                      )}
                    </div>

                    {session.session_description && (
                      <p className="text-xs text-muted-foreground truncate mb-2">{session.session_description}</p>
                    )}

                    <div className="flex items-center gap-4 text-[11px] text-muted-foreground/70">
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {date}
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {session.participant_count || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        {session.comment_count || 0}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => navigate(`/admin/archive/${session._id}`)}
                      className="inline-flex items-center gap-1.5 text-[11px] font-bold px-4 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all uppercase active:scale-95"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 bg-white px-5 py-3 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500">
            Page {pagination.page} of {pagination.totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={pagination.page <= 1}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
              className="text-xs font-semibold px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition disabled:opacity-40"
            >
              Previous
            </button>
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              className="text-xs font-semibold px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
