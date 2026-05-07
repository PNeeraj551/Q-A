import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getArchivedSessionById, getArchivedSessionComments } from '../../api/archive';
import PostSessionAnalyticsPanel from '../../components/PostSessionAnalyticsPanel';

export default function ArchivedSessionDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 1
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [sessionRes, commentsRes] = await Promise.all([
        getArchivedSessionById(id),
        getArchivedSessionComments(id, { page: pagination.page, limit: pagination.limit }),
      ]);

      setSession(sessionRes.data.session);
      setComments(commentsRes.data.comments || []);
      setPagination(prev => ({
        ...prev,
        total: commentsRes.data.total || 0,
        totalPages: commentsRes.data.totalPages || 1
      }));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch archived session details.');
    } finally {
      setLoading(false);
    }
  }, [id, pagination.page, pagination.limit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const structuredComments = useMemo(() => {
    const topLevel = [];
    const replyMap = {};

    comments.forEach(c => {
      if (c.parent_id) {
        if (!replyMap[c.parent_id]) replyMap[c.parent_id] = [];
        replyMap[c.parent_id].push(c);
      } else {
        topLevel.push(c);
      }
    });

    return { topLevel, replyMap };
  }, [comments]);

  const renderComment = (comment, isReply = false) => (
    <div key={comment._id} className={`p-4 rounded-xl border ${isReply ? 'border-gray-200 bg-white ml-8 mt-3 relative before:absolute before:-left-5 before:top-6 before:w-4 before:h-px before:bg-gray-300 after:absolute after:-left-5 after:top-0 after:bottom-0 after:w-px after:bg-gray-300' : 'border-gray-100 bg-gray-50/50'} shadow-sm`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-900 flex items-center gap-1.5">
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${comment.is_admin_comment ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
            {comment.participant_name?.[0]?.toUpperCase() || '?'}
          </span>
          {comment.participant_name || 'Participant'}
          {comment.is_admin_comment && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
              Admin
            </span>
          )}
          {isReply && (
            <span className="ml-1 text-xs font-normal text-gray-400">
              replied
            </span>
          )}
        </span>
        <span className="text-xs text-gray-400">
          {new Date(comment.created_at).toLocaleString()}
        </span>
      </div>
      <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.comment_text}</p>
      {comment.is_coordinated_submission && (
        <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-200 px-2 py-0.5 rounded-full font-medium">
          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Coordinated Submission
        </span>
      )}

      <div className="mt-3 flex items-center gap-3">
        <span 
          className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-white px-2.5 py-1.5 rounded-md border border-gray-100 cursor-help hover:bg-gray-50 transition"
          title={comment.liked_by && comment.liked_by.length > 0 ? comment.liked_by.map(u => u.name).join(', ') : 'No likes'}
        >
          <svg className="w-3.5 h-3.5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
          </svg>
          {comment.liked_by ? comment.liked_by.length : 0}
        </span>
        {comment.sentiment && (
          <span className="inline-flex items-center text-xs font-medium text-gray-500">
            Sentiment: <span className="ml-1 capitalize">{comment.sentiment}</span>
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="bg-card border-b border-border px-6 py-4 shrink-0 shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/admin/archive')}
              className="p-2 text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted rounded-xl transition-all active:scale-95"
              title="Back to Archives"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold text-foreground">Session Archive</h1>
              <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                Reviewing completed session data
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 px-6 py-6 max-w-4xl mx-auto w-full">
        {loading && !session && (
          <div className="flex justify-center py-24">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 flex items-center gap-2 mb-4">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 8v4m0 4h.01" />
            </svg>
            {error}
          </div>
        )}

        {!loading && session && (
          <div className="space-y-6">
            {/* Session Info Card */}
            <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-foreground">{session.session_title}</h2>
                  {session.session_description && (
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{session.session_description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-muted text-muted-foreground ring-1 ring-border uppercase">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                    Closed
                  </span>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold ring-1 uppercase ${session.access_type === 'PRIVATE' ? 'bg-indigo-50 text-indigo-700 ring-indigo-200' : 'bg-sky-50 text-sky-700 ring-sky-200'}`}>
                    {session.access_type}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-8 pt-6 border-t border-border">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Planned Date</p>
                  <p className="text-sm font-semibold text-foreground">
                    {new Date(session.planned_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Time</p>
                  <p className="text-sm font-semibold text-foreground">
                    {new Date(session.planned_start_time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Closed At</p>
                  <p className="text-sm font-semibold text-foreground">
                    {session.closed_at ? new Date(session.closed_at).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Participants</p>
                  <p className="text-sm font-semibold text-foreground">
                    {session.assigned_participants ? session.assigned_participants.length : 0} Members
                  </p>
                </div>
              </div>
            </div>

            <PostSessionAnalyticsPanel sessionId={id} sessionStatus="CLOSED" />

            {/* Questions / Comments List */}
            <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col">
              <div className="px-6 py-4 border-b border-border bg-muted/20 flex justify-between items-center">
                <h3 className="text-base font-bold text-foreground">Questions & Comments</h3>
                <span className="text-[10px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full uppercase">
                  {pagination.total} total
                </span>
              </div>

              <div className="p-6">
                {comments.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <p className="text-sm text-gray-500">No questions or comments in this session.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {structuredComments.topLevel.map((comment) => (
                      <div key={comment._id} className="relative">
                        {renderComment(comment, false)}
                        {/* Render Replies */}
                        {structuredComments.replyMap[comment._id] && (
                          <div className="mt-2 space-y-3">
                            {structuredComments.replyMap[comment._id].map(reply => (
                              <div key={reply._id}>
                                {renderComment(reply, true)}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-100">
                    <button
                      disabled={pagination.page <= 1}
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="text-xs text-gray-500">
                      Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <button
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
