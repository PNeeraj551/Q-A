const db = require('../config/supabase');
const Question = require('../models/Question');
const Reply = require('../models/Reply');
const { broadcastToChannel } = require('../utils/broadcast');
const { success, error } = require('../utils/responseUtils');
const { isBoardClosed } = require('../utils/boardUtils');

// GET /api/qna/:qnaId/questions/:qId/replies
const listReplies = async (req, res) => {
  try {
    const { qId } = req.params;
    const userId = req.user.user_id;
    const [replies, likedSet] = await Promise.all([
      Reply.listByQuestion(qId),
      Reply.getAllLikedByUser(userId),
    ]);
    const result = replies.map((r) => ({ ...r, liked_by_me: likedSet.has(r.id) }));
    return success(res, { replies: result });
  } catch (err) {
    return error(res, 'Failed to load replies.', 500);
  }
};

// POST /api/qna/:qnaId/questions/:qId/replies
const createReply = async (req, res) => {
  const { text } = req.body;
  const { qnaId, qId } = req.params;

  if (!text || typeof text !== 'string' || !text.trim()) {
    return error(res, 'Reply text is required', 400);
  }
  if (text.trim().length > 1000) {
    return error(res, 'Reply must be 1000 characters or fewer', 400);
  }

  try {
    if (isBoardClosed(req.qnaPost)) {
      return error(res, 'This Q&A board is closed.', 403);
    }

    const question = await Question.findById(qId);
    if (!question || question.is_deleted) return error(res, 'Question not found', 404);

    const reply = await Reply.create({
      question_id: qId,
      qna_id: qnaId,
      text: text.trim(),
      author_id: req.user.user_id,
      author_name: req.user.name,
    });

    await db.rpc('increment_reply_count', { p_question_id: qId });

    await broadcastToChannel(`qna_${qnaId}`, 'reply:new', { reply, question_id: qId });

    return success(res, { reply }, 201);
  } catch (err) {
    return error(res, 'Failed to post reply.', 500);
  }
};

// PATCH /api/qna/:qnaId/questions/:qId/replies/:rId
const updateReply = async (req, res) => {
  const { text } = req.body;
  const { rId } = req.params;

  if (!text || typeof text !== 'string' || !text.trim()) {
    return error(res, 'Reply text is required', 400);
  }
  if (text.trim().length > 1000) {
    return error(res, 'Reply must be 1000 characters or fewer', 400);
  }

  try {
    const reply = await Reply.findById(rId);
    if (!reply || reply.is_deleted) return error(res, 'Reply not found', 404);

    if (reply.author_id !== req.user.user_id && req.user.role !== 'admin') {
      return error(res, 'Not authorized', 403);
    }

    const updated = await Reply.updateById(rId, { text: text.trim() });
    return success(res, { reply: updated });
  } catch (err) {
    return error(res, 'Failed to update reply.', 500);
  }
};

// DELETE /api/qna/:qnaId/questions/:qId/replies/:rId
const deleteReply = async (req, res) => {
  const { qId, rId, qnaId } = req.params;

  try {
    const reply = await Reply.findById(rId);
    if (!reply || reply.is_deleted) return error(res, 'Reply not found', 404);

    if (reply.author_id !== req.user.user_id && req.user.role !== 'admin') {
      return error(res, 'Not authorized', 403);
    }

    await Reply.softDeleteById(rId);
    await db.rpc('decrement_reply_count', { p_question_id: qId });

    await broadcastToChannel(`qna_${qnaId}`, 'reply:delete', { reply_id: rId, question_id: qId });

    return success(res, { message: 'Reply deleted' });
  } catch (err) {
    return error(res, 'Failed to delete reply.', 500);
  }
};

// PATCH /api/qna/:qnaId/questions/:qId/replies/:rId/like
const toggleLike = async (req, res) => {
  const { rId, qnaId } = req.params;
  const userId = req.user.user_id;

  try {
    if (isBoardClosed(req.qnaPost)) {
      return error(res, 'This Q&A board is closed.', 403);
    }

    const reply = await Reply.findById(rId);
    if (!reply || reply.is_deleted) return error(res, 'Reply not found', 404);

    const already_liked = await Reply.isLikedByUser(rId, userId);

    if (already_liked) {
      await db.from('reply_likes').delete().eq('reply_id', rId).eq('user_id', userId);
    } else {
      await db.from('reply_likes').upsert({ reply_id: rId, user_id: userId });
    }

    const liked_by_me = !already_liked;
    const { count } = await db.from('reply_likes').select('*', { count: 'exact', head: true }).eq('reply_id', rId);
    const likes_count = count || 0;
    await db.from('replies').update({ likes_count }).eq('id', rId);

    return success(res, { likes_count, liked_by_me });
  } catch (err) {
    return error(res, 'Failed to update like.', 500);
  }
};

module.exports = { listReplies, createReply, updateReply, deleteReply, toggleLike };
