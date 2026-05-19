const supabase = require('../../../../../../_lib/supabase');
const { withQnaAccess } = require('../../../../../../_lib/qnaAccess');
const { broadcastToChannel } = require('../../../../../../_lib/realtime');
const { sendSuccess, sendError, handleCors, formatReply } = require('../../../../../../_lib/response');

async function updateReply(req, res, user, qnaPost) {
  const { qId, rId } = req.query;
  const { text } = req.body || {};

  if (!text || typeof text !== 'string' || !text.trim()) return sendError(res, 'Reply text is required', 400);
  if (text.trim().length > 1000) return sendError(res, 'Reply must be 1000 characters or fewer', 400);

  try {
    const { data: reply } = await supabase
      .from('replies')
      .select('id, author_id')
      .eq('id', rId)
      .eq('is_deleted', false)
      .maybeSingle();

    if (!reply) return sendError(res, 'Reply not found', 404);

    const isOwner = reply.author_id === user.user_id;
    if (!isOwner && user.role !== 'admin') return sendError(res, 'Not authorized', 403);

    const { data: updated } = await supabase
      .from('replies')
      .update({ text: text.trim() })
      .eq('id', rId)
      .select('*')
      .single();

    return sendSuccess(res, { reply: formatReply(updated) });
  } catch (_) {
    return sendError(res, 'Failed to update reply.', 500);
  }
}

async function deleteReply(req, res, user, qnaPost) {
  const { qId, rId } = req.query;

  try {
    const { data: reply } = await supabase
      .from('replies')
      .select('id, author_id')
      .eq('id', rId)
      .eq('is_deleted', false)
      .maybeSingle();

    if (!reply) return sendError(res, 'Reply not found', 404);

    const isOwner = reply.author_id === user.user_id;
    if (!isOwner && user.role !== 'admin') return sendError(res, 'Not authorized', 403);

    // Clear accepted_reply reference before soft-deleting
    await supabase.from('questions').update({ accepted_reply_id: null }).eq('accepted_reply_id', rId);

    await supabase.from('replies').update({ is_deleted: true }).eq('id', rId);
    await supabase.rpc('decrement_reply_count', { p_question_id: qId });

    broadcastToChannel(`qna_${qnaPost.id}`, 'reply:delete', { reply_id: rId, question_id: qId });

    return sendSuccess(res, { message: 'Reply deleted' });
  } catch (_) {
    return sendError(res, 'Failed to delete reply.', 500);
  }
}

module.exports = function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method === 'PATCH') return withQnaAccess(updateReply)(req, res);
  if (req.method === 'DELETE') return withQnaAccess(deleteReply)(req, res);

  return sendError(res, 'Method not allowed', 405);
};
