const Question = require('../models/Question');
const Reply = require('../models/Reply');
const { getIO } = require('../sockets/io');
const { success, error } = require('../utils/responseUtils');

// GET /api/qna/:qnaId/questions/:qId/replies
const listReplies = async (req, res) => {
  try {
    const { qId } = req.params;

    const replies = await Reply.find({ question_id: qId, is_deleted: false })
      .sort({ created_at: 1 })
      .lean();

    return success(res, { replies });
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
    const qnaPost = req.qnaPost
    if (qnaPost?.status === 'CLOSED' || (qnaPost?.end_at && new Date() >= new Date(qnaPost.end_at))) {
      return error(res, 'This Q&A board is closed.', 403);
    }

    const question = await Question.findById(qId).select('_id is_deleted').lean();
    if (!question || question.is_deleted) return error(res, 'Question not found', 404);

    const reply = await Reply.create({
      question_id: qId,
      qna_id: qnaId,
      text: text.trim(),
      author_id: req.user.user_id,
      author_name: req.user.name,
    });

    // Increment reply_count on question
    await Question.findByIdAndUpdate(qId, { $inc: { reply_count: 1 } });

    // Broadcast to qna room
    try {
      getIO().to(`qna_${qnaId}`).emit('reply:new', { reply: reply.toObject(), question_id: qId });
    } catch (_) {}

    return success(res, { reply: reply.toObject() }, 201);
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

    const isOwner = reply.author_id.toString() === req.user.user_id;
    if (!isOwner && req.user.role !== 'admin') {
      return error(res, 'Not authorized', 403);
    }

    reply.text = text.trim();
    reply.updated_at = new Date();
    await reply.save();

    return success(res, { reply: reply.toObject() });
  } catch (err) {
    return error(res, 'Failed to update reply.', 500);
  }
};

// DELETE /api/qna/:qnaId/questions/:qId/replies/:rId
const deleteReply = async (req, res) => {
  const { qId, rId } = req.params;

  try {
    const reply = await Reply.findById(rId);
    if (!reply || reply.is_deleted) return error(res, 'Reply not found', 404);

    const isOwner = reply.author_id.toString() === req.user.user_id;
    if (!isOwner && req.user.role !== 'admin') {
      return error(res, 'Not authorized', 403);
    }

    reply.is_deleted = true;
    await reply.save();

    // Decrement reply_count on question
    await Question.findByIdAndUpdate(qId, { $inc: { reply_count: -1 } });

    try {
      getIO().to(`qna_${req.params.qnaId}`).emit('reply:delete', { reply_id: rId, question_id: qId });
    } catch (_) {}

    return success(res, { message: 'Reply deleted' });
  } catch (err) {
    return error(res, 'Failed to delete reply.', 500);
  }
};

module.exports = { listReplies, createReply, updateReply, deleteReply };
