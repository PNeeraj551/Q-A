const db = require('../config/supabase');
const Question = require('../models/Question');
const { broadcastToChannel } = require('../utils/broadcast');
const { success, error } = require('../utils/responseUtils');
const { isBoardClosed } = require('../utils/boardUtils');

// GET /api/qna/:qnaId/questions
const listQuestions = async (req, res) => {
  try {
    const { qnaId } = req.params;
    const userId = req.user.user_id;

    const [questions, likedSet] = await Promise.all([
      Question.listByQna(qnaId),
      Question.getLikedQuestionIds(qnaId, userId),
    ]);

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
    const question = await Question.create({
      qna_id: qnaId,
      text: sanitized,
      author_id: req.user.user_id,
      author_name: req.user.name,
    });

    const result = { ...question, liked_by_me: false };

    broadcastToChannel(`qna_${qnaId}`, 'question:new', result);
    broadcastToChannel('qna_global', 'question:count_change', { qna_id: qnaId, delta: 1 });

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
    const likedSet = await Question.getLikedQuestionIds(qnaId, req.user.user_id);
    const result = { ...updated, liked_by_me: likedSet.has(updated.id) };

    broadcastToChannel(`qna_${qnaId}`, 'question:update', result);

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

    broadcastToChannel(`qna_${qnaId}`, 'question:delete', { question_id: qId });
    broadcastToChannel('qna_global', 'question:count_change', { qna_id: qnaId, delta: -1 });

    return success(res, { message: 'Question deleted' });
  } catch (err) {
    return error(res, 'Failed to delete question.', 500);
  }
};

// PATCH /api/qna/:qnaId/questions/:qId/like
const toggleLike = async (req, res) => {
  const { qId, qnaId } = req.params;
  const userId = req.user.user_id;

  try {
    if (isBoardClosed(req.qnaPost)) {
      return error(res, 'This Q&A board is closed.', 403);
    }

    const question = await Question.findById(qId);
    if (!question || question.is_deleted) return error(res, 'Question not found', 404);

    const { data, error: rpcErr } = await db.rpc('toggle_question_like', {
      p_question_id: qId,
      p_user_id: userId,
    });
    if (rpcErr) throw rpcErr;

    const result = data && data[0] ? data[0] : { likes_count: question.likes_count, liked_by_me: false };

    broadcastToChannel(`qna_${qnaId}`, 'question:like', {
      question_id: qId,
      likes_count: result.likes_count,
    });

    return success(res, { likes_count: result.likes_count, liked_by_me: result.liked_by_me });
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
  } catch (err) {
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
    const likedSet = await Question.getLikedQuestionIds(qnaId, req.user.user_id);
    const result = { ...updated, liked_by_me: likedSet.has(updated.id) };

    broadcastToChannel(`qna_${qnaId}`, 'question:update', result);

    return success(res, { question: result });
  } catch (err) {
    return error(res, 'Failed to update accepted reply.', 500);
  }
};

module.exports = { listQuestions, createQuestion, updateQuestion, deleteQuestion, toggleLike, markAcceptedReply, trackView };
