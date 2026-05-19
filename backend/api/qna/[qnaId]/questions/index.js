const supabase = require('../../../../_lib/supabase');
const { withQnaAccess } = require('../../../../_lib/qnaAccess');
const { broadcastToChannel } = require('../../../../_lib/realtime');
const { sendSuccess, sendError, handleCors, formatQuestion } = require('../../../../_lib/response');

const TEXT_SANITIZE = (s) =>
  s.replace(/\0/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim();

const isBoardClosed = (post) =>
  post?.status === 'CLOSED' || (post?.end_at && new Date() >= new Date(post.end_at));

async function listQuestions(req, res, user, qnaPost) {
  try {
    const { data: questions, error } = await supabase
      .from('questions')
      .select('*, question_likes(user_id)')
      .eq('qna_id', qnaPost.id)
      .eq('is_deleted', false)
      .order('likes_count', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(200);

    if (error) throw error;

    const result = questions.map((q) => formatQuestion(q, user.user_id));
    return sendSuccess(res, { questions: result });
  } catch (_) {
    return sendError(res, 'Failed to load questions.', 500);
  }
}

async function createQuestion(req, res, user, qnaPost) {
  const { text } = req.body || {};

  if (!text || typeof text !== 'string' || !text.trim()) {
    return sendError(res, 'Question text is required', 400);
  }
  const sanitized = TEXT_SANITIZE(text);
  if (sanitized.length > 5000) return sendError(res, 'Question must be 5000 characters or fewer', 400);
  if (isBoardClosed(qnaPost)) return sendError(res, 'This Q&A board is closed. No new questions can be posted.', 403);

  try {
    const { data: question, error } = await supabase
      .from('questions')
      .insert({
        qna_id: qnaPost.id,
        text: sanitized,
        author_id: user.user_id,
        author_name: user.name,
      })
      .select('*')
      .single();

    if (error) throw error;

    const result = formatQuestion(question, user.user_id);

    broadcastToChannel(`qna_${qnaPost.id}`, 'question:new', result);
    broadcastToChannel('qna_global', 'question:count_change', { qna_id: qnaPost.id, delta: 1 });

    return sendSuccess(res, { question: result }, 201);
  } catch (err) {
    console.error('[createQuestion]', err);
    return sendError(res, 'Failed to post question.', 500);
  }
}

module.exports = function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method === 'GET') return withQnaAccess(listQuestions)(req, res);
  if (req.method === 'POST') return withQnaAccess(createQuestion)(req, res);

  return sendError(res, 'Method not allowed', 405);
};
