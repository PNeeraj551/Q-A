const supabase = require('../../../../../../_lib/supabase');
const { withQnaAccess } = require('../../../../../../_lib/qnaAccess');
const { broadcastToChannel } = require('../../../../../../_lib/realtime');
const { sendSuccess, sendError, handleCors, formatReply } = require('../../../../../../_lib/response');

const isBoardClosed = (post) =>
  post?.status === 'CLOSED' || (post?.end_at && new Date() >= new Date(post.end_at));

async function listReplies(req, res, user, qnaPost) {
  const { qId } = req.query;

  try {
    const { data: replies, error } = await supabase
      .from('replies')
      .select('*')
      .eq('question_id', qId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return sendSuccess(res, { replies: replies.map(formatReply) });
  } catch (_) {
    return sendError(res, 'Failed to load replies.', 500);
  }
}

async function createReply(req, res, user, qnaPost) {
  const { qId } = req.query;
  const { text } = req.body || {};

  if (!text || typeof text !== 'string' || !text.trim()) return sendError(res, 'Reply text is required', 400);
  if (text.trim().length > 1000) return sendError(res, 'Reply must be 1000 characters or fewer', 400);
  if (isBoardClosed(qnaPost)) return sendError(res, 'This Q&A board is closed.', 403);

  try {
    const { data: question } = await supabase
      .from('questions')
      .select('id')
      .eq('id', qId)
      .eq('is_deleted', false)
      .maybeSingle();

    if (!question) return sendError(res, 'Question not found', 404);

    const { data: reply, error } = await supabase
      .from('replies')
      .insert({
        question_id: qId,
        qna_id: qnaPost.id,
        text: text.trim(),
        author_id: user.user_id,
        author_name: user.name,
      })
      .select('*')
      .single();

    if (error) throw error;

    await supabase.rpc('increment_reply_count', { p_question_id: qId });

    const formatted = formatReply(reply);
    broadcastToChannel(`qna_${qnaPost.id}`, 'reply:new', { reply: formatted, question_id: qId });

    return sendSuccess(res, { reply: formatted }, 201);
  } catch (err) {
    console.error('[createReply]', err);
    return sendError(res, 'Failed to post reply.', 500);
  }
}

module.exports = function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method === 'GET') return withQnaAccess(listReplies)(req, res);
  if (req.method === 'POST') return withQnaAccess(createReply)(req, res);

  return sendError(res, 'Method not allowed', 405);
};
