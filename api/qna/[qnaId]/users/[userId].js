const supabase = require('../../../../_lib/supabase');
const { withRole } = require('../../../../_lib/roleGuard');
const { sendSuccess, sendError, handleCors } = require('../../../../_lib/response');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function removeBoardUser(req, res) {
  const { qnaId, userId } = req.query;

  if (!qnaId || !UUID_RE.test(qnaId)) return sendError(res, 'Q&A not found', 404);
  if (!userId || !UUID_RE.test(userId)) return sendError(res, 'Invalid user ID', 400);

  try {
    const { data: post } = await supabase.from('qna_posts').select('id').eq('id', qnaId).maybeSingle();
    if (!post) return sendError(res, 'Q&A not found', 404);

    await supabase.from('qna_allowed_users').delete().eq('qna_id', qnaId).eq('user_id', userId);

    return sendSuccess(res, { message: 'User removed' });
  } catch (_) {
    return sendError(res, 'Failed to remove user.', 500);
  }
}

module.exports = function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'DELETE') return sendError(res, 'Method not allowed', 405);
  return withRole('admin', removeBoardUser)(req, res);
};
