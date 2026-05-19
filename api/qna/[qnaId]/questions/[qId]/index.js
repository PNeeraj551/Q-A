const supabase = require('../../../../../_lib/supabase');
const { withQnaAccess } = require('../../../../../_lib/qnaAccess');
const { broadcastToChannel } = require('../../../../../_lib/realtime');
const { sendSuccess, sendError, handleCors, formatQuestion } = require('../../../../../_lib/response');

const TEXT_SANITIZE = (s) =>
  s.replace(/\0/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim();

async function updateQuestion(req, res, user, qnaPost) {
  const { qId } = req.query;
  const { text } = req.body || {};

  if (!text || typeof text !== 'string' || !text.trim()) return sendError(res, 'Question text is required', 400);
  const sanitized = TEXT_SANITIZE(text);
  if (sanitized.length > 5000) return sendError(res, 'Question must be 5000 characters or fewer', 400);

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

    const { data: updated } = await supabase
      .from('questions')
      .update({ text: sanitized })
      .eq('id', qId)
      .select('*, question_likes(user_id)')
      .single();

    const result = formatQuestion(updated, user.user_id);
    broadcastToChannel(`qna_${qnaPost.id}`, 'question:update', result);

    return sendSuccess(res, { question: result });
  } catch (_) {
    return sendError(res, 'Failed to update question.', 500);
  }
}

async function deleteQuestion(req, res, user, qnaPost) {
  const { qId } = req.query;

  try {
    const { data: question } = await supabase
      .from('questions')
      .select('id, author_id')
      .eq('id', qId)
      .eq('is_deleted', false)
      .maybeSingle();

    if (!question) return sendError(res, 'Question not found', 404);

    const isOwner = question.author_id === user.user_id;
    if (!isOwner && user.role !== 'admin') return sendError(res, 'Not authorized', 403);

    await supabase.from('questions').update({ is_deleted: true }).eq('id', qId);

    broadcastToChannel(`qna_${qnaPost.id}`, 'question:delete', { question_id: qId });
    broadcastToChannel('qna_global', 'question:count_change', { qna_id: qnaPost.id, delta: -1 });

    return sendSuccess(res, { message: 'Question deleted' });
  } catch (_) {
    return sendError(res, 'Failed to delete question.', 500);
  }
}

module.exports = function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method === 'PATCH') return withQnaAccess(updateQuestion)(req, res);
  if (req.method === 'DELETE') return withQnaAccess(deleteQuestion)(req, res);

  return sendError(res, 'Method not allowed', 405);
};
