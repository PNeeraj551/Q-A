const supabase = require('../../../../../_lib/supabase');
const { withQnaAccess } = require('../../../../../_lib/qnaAccess');
const { broadcastToChannel } = require('../../../../../_lib/realtime');
const { sendSuccess, sendError, handleCors } = require('../../../../../_lib/response');

const isBoardClosed = (post) =>
  post?.status === 'CLOSED' || (post?.end_at && new Date() >= new Date(post.end_at));

async function toggleLike(req, res, user, qnaPost) {
  const { qId } = req.query;

  if (isBoardClosed(qnaPost)) return sendError(res, 'This Q&A board is closed.', 403);

  try {
    const { data: question } = await supabase
      .from('questions')
      .select('id')
      .eq('id', qId)
      .eq('is_deleted', false)
      .maybeSingle();

    if (!question) return sendError(res, 'Question not found', 404);

    const { data: rows, error } = await supabase.rpc('toggle_question_like', {
      p_question_id: qId,
      p_user_id: user.user_id,
    });

    if (error) throw error;

    const result = rows[0];
    broadcastToChannel(`qna_${qnaPost.id}`, 'question:like', {
      question_id: qId,
      likes_count: result.likes_count,
    });

    return sendSuccess(res, { likes_count: result.likes_count, liked_by_me: result.liked_by_me });
  } catch (err) {
    console.error('[toggleLike]', err);
    return sendError(res, 'Failed to update like.', 500);
  }
}

module.exports = function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'PATCH') return sendError(res, 'Method not allowed', 405);
  return withQnaAccess(toggleLike)(req, res);
};
