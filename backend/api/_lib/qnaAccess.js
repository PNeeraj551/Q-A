const { withAuth } = require('./auth');
const supabase = require('./supabase');
const { sendError } = require('./response');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// withQnaAccess(handler) — resolves the qnaPost and checks visibility/access
// handler signature: async (req, res, user, qnaPost) => {}
// qnaPost includes qna_allowed_users: [{ user_id }]
function withQnaAccess(handler) {
  return withAuth(async (req, res, user) => {
    const qnaId = req.query.qnaId || req.query.id;

    if (!qnaId || !UUID_RE.test(qnaId)) {
      return sendError(res, 'Q&A not found', 404);
    }

    try {
      const { data: post } = await supabase
        .from('qna_posts')
        .select('*, qna_allowed_users(user_id)')
        .eq('id', qnaId)
        .maybeSingle();

      if (!post) return sendError(res, 'Q&A not found', 404);

      if (user.role === 'admin') {
        return handler(req, res, user, post);
      }

      if (post.visibility === 'PUBLIC') {
        return handler(req, res, user, post);
      }

      // PRIVATE: check allowed_users — return 404 to not reveal existence
      const allowed = (post.qna_allowed_users || []).some((r) => r.user_id === user.user_id);
      if (!allowed) return sendError(res, 'Q&A not found', 404);

      return handler(req, res, user, post);
    } catch (_) {
      return sendError(res, 'Q&A not found', 404);
    }
  });
}

module.exports = { withQnaAccess };
