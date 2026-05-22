const db = require('../config/supabase');
const Question = require('../models/Question');
const { broadcastToChannel } = require('../utils/broadcast');
const { success, error } = require('../utils/responseUtils');
const { isBoardClosed } = require('../utils/boardUtils');

// GET /api/qna/:qnaId/questions
const listQuestions = async (req, res) => {
  try {
    const { qnaId } = req.params;
    const userId = req.user?.user_id || req.userSession?.user_id || null;

    const questions = await Question.listByQna(qnaId);

    const likedSet = userId ? await Question.getAllLikedByUser(userId) : new Set();

    const result = questions.map((q) => ({
      ...q,
      liked_by_me: likedSet.has(q.id),
    }));

    return success(res, { questions: result });
  } catch (err) {
    return error(res, 'Failed to load questions.', 500);
  }
};

// POST /api/qna/:qnaId/questions
const createQuestion = async (req, res) => {
  const { text } = req.body;
  const { qnaId } = req.params;

  if (!text || typeof text !== 'string' || !text.trim()) {
    return error(res, 'Question text is required', 400);
  }
  const sanitized = text.replace(/\0/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim();
  if (sanitized.length > 5000) {
    return error(res, 'Question must be 5000 characters or fewer', 400);
  }
  if (isBoardClosed(req.qnaPost)) {
    return error(res, 'This Q&A board is closed. No new questions can be posted.', 403);
  }

  try {
    const isPublicSession = !!req.userSession;
    const authorId = isPublicSession ? req.userSession.user_id : req.user.user_id;
    const authorName = isPublicSession
      ? (req.userSession.is_anonymous ? 'Anonymous' : (req.userSession.display_name || 'Anonymous'))
      : req.user.name;

    const question = await Question.create({
      qna_id: qnaId,
      text: sanitized,
      author_id: authorId,
      author_name: authorName,
    });

    const result = { ...question, liked_by_me: false };

    await Promise.all([
      broadcastToChannel(`qna_${qnaId}`, 'question:new', result),
      broadcastToChannel('qna_global', 'question:count_change', { qna_id: qnaId, delta: 1 }),
    ]);

    return success(res, { question: result }, 201);
  } catch (err) {
    return error(res, 'Failed to post question.', 500);
  }
};

// PATCH /api/qna/:qnaId/questions/:qId
const updateQuestion = async (req, res) => {
  const { text } = req.body;
  const { qId, qnaId } = req.params;

  if (!text || typeof text !== 'string' || !text.trim()) {
    return error(res, 'Question text is required', 400);
  }
  const sanitized = text.replace(/\0/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim();
  if (sanitized.length > 5000) {
    return error(res, 'Question must be 5000 characters or fewer', 400);
  }

  try {
    const question = await Question.findById(qId);
    if (!question || question.is_deleted) return error(res, 'Question not found', 404);

    if (question.author_id !== req.user.user_id && req.user.role !== 'admin') {
      return error(res, 'Not authorized', 403);
    }

    const updated = await Question.updateById(qId, { text: sanitized });
    const liked_by_me = await Question.isLikedByUser(qId, req.user.user_id);
    const result = { ...updated, liked_by_me };

    await broadcastToChannel(`qna_${qnaId}`, 'question:update', result);

    return success(res, { question: result });
  } catch (err) {
    return error(res, 'Failed to update question.', 500);
  }
};

// DELETE /api/qna/:qnaId/questions/:qId
const deleteQuestion = async (req, res) => {
  const { qId, qnaId } = req.params;

  try {
    const question = await Question.findById(qId);
    if (!question || question.is_deleted) return error(res, 'Question not found', 404);

    if (question.author_id !== req.user.user_id && req.user.role !== 'admin') {
      return error(res, 'Not authorized', 403);
    }

    await Question.softDeleteById(qId);

    await Promise.all([
      broadcastToChannel(`qna_${qnaId}`, 'question:delete', { question_id: qId }),
      broadcastToChannel('qna_global', 'question:count_change', { qna_id: qnaId, delta: -1 }),
    ]);

    return success(res, { message: 'Question deleted' });
  } catch (err) {
    return error(res, 'Failed to delete question.', 500);
  }
};

// PATCH /api/qna/:qnaId/questions/:qId/like
const toggleLike = async (req, res) => {
  const { qId, qnaId } = req.params;
  const userId = req.user?.user_id || req.userSession?.user_id || null;

  try {
    if (!userId) return error(res, 'Authentication required to like', 401);
    if (isBoardClosed(req.qnaPost)) return error(res, 'This Q&A board is closed.', 403);

    const question = await Question.findById(qId);
    if (!question || question.is_deleted) return error(res, 'Question not found', 404);

    let likes_count, liked_by_me;

    const { data, error: rpcErr } = await db.rpc('toggle_question_like', {
      p_question_id: qId,
      p_user_id: userId,
    });

    if (!rpcErr && data?.[0]) {
      likes_count = data[0].likes_count;
      liked_by_me = data[0].liked_by_me;
    } else {
      if (rpcErr) console.error('[toggleLike] RPC error:', rpcErr);
      const already_liked = await Question.isLikedByUser(qId, userId);
      if (already_liked) {
        await db.from('question_likes').delete().eq('question_id', qId).eq('user_id', userId);
      } else {
        await db.from('question_likes').upsert({ question_id: qId, user_id: userId });
      }
      liked_by_me = !already_liked;
      const { count } = await db.from('question_likes').select('*', { count: 'exact', head: true }).eq('question_id', qId);
      likes_count = count || 0;
      await db.from('questions').update({ likes_count }).eq('id', qId);
    }

    await broadcastToChannel(`qna_${qnaId}`, 'question:like', { question_id: qId, likes_count });
    return success(res, { likes_count, liked_by_me });
  } catch (err) {
    return error(res, 'Failed to update like.', 500);
  }
};

// PATCH /api/qna/:qnaId/questions/:qId/view
const trackView = async (req, res) => {
  const { qId } = req.params;
  try {
    await db.rpc('increment_view_count', { p_question_id: qId });
    const question = await Question.findById(qId);
    if (!question) return error(res, 'Question not found', 404);
    return success(res, { view_count: question.view_count });
  } catch {
    return error(res, 'Failed to track view.', 500);
  }
};

// PATCH /api/qna/:qnaId/questions/:qId/accept-reply
const markAcceptedReply = async (req, res) => {
  const { qId, qnaId } = req.params;
  const { reply_id } = req.body;

  try {
    const question = await Question.findById(qId);
    if (!question || question.is_deleted) return error(res, 'Question not found', 404);

    if (question.author_id !== req.user.user_id && req.user.role !== 'admin') {
      return error(res, 'Not authorized', 403);
    }

    const updated = await Question.updateById(qId, { accepted_reply_id: reply_id || null });
    const liked_by_me = await Question.isLikedByUser(qId, req.user.user_id);
    const result = { ...updated, liked_by_me };

    await broadcastToChannel(`qna_${qnaId}`, 'question:update', result);

    return success(res, { question: result });
  } catch (err) {
    return error(res, 'Failed to update accepted reply.', 500);
  }
};

module.exports = { listQuestions, createQuestion, updateQuestion, deleteQuestion, toggleLike, markAcceptedReply, trackView };
