const supabase = require('../../../../../_lib/supabase');
const { withQnaAccess } = require('../../../../../_lib/qnaAccess');
const { broadcastToChannel } = require('../../../../../_lib/realtime');
const { sendSuccess, sendError, handleCors, formatQuestion } = require('../../../../../_lib/response');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function acceptReply(req, res, user, qnaPost) {
  const { qId } = req.query;
  const { reply_id } = req.body || {};

  try {
    const { data: question } = await supabase
      .from('questions')
      .select('id, author_id, question_likes(user_id)')
      .eq('id', qId)
      .eq('is_deleted', false)
      .maybeSingle();

    if (!question) return sendError(res, 'Question not found', 404);

    const isOwner = question.author_id === user.user_id;
    if (!isOwner && user.role !== 'admin') return sendError(res, 'Not authorized', 403);

    const accepted = reply_id && UUID_RE.test(reply_id) ? reply_id : null;

    const { data: updated } = await supabase
      .from('questions')
      .update({ accepted_reply_id: accepted })
      .eq('id', qId)
      .select('*, question_likes(user_id)')
      .single();

    const result = formatQuestion(updated, user.user_id);
    broadcastToChannel(`qna_${qnaPost.id}`, 'question:update', result);

    return sendSuccess(res, { question: result });
  } catch (err) {
    console.error('[acceptReply]', err);
    return sendError(res, 'Failed to update accepted reply.', 500);
  }
}

module.exports = function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'PATCH') return sendError(res, 'Method not allowed', 405);
  return withQnaAccess(acceptReply)(req, res);
};
