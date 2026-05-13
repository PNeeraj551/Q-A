const mongoose = require('mongoose');
const Question = require('../models/Question');
const { getIO } = require('../sockets/io');
const { success, error } = require('../utils/responseUtils');

// GET /api/qna/:qnaId/questions
const listQuestions = async (req, res) => {
  try {
    const { qnaId } = req.params;

    const questions = await Question.find({ qna_id: qnaId, is_deleted: false })
      .sort({ likes_count: -1, created_at: 1 })
      .lean();

    // Mark which questions the current user has liked
    const userId = req.user.user_id;
    const result = questions.map((q) => ({
      ...q,
      liked_by_me: q.likes.some((id) => id.toString() === userId),
      likes: undefined, // don't expose full likes array to client
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
  if (text.trim().length > 1000) {
    return error(res, 'Question must be 1000 characters or fewer', 400);
  }
  const post = req.qnaPost
  const effectivelyClosed = post?.status === 'CLOSED' || (post?.end_at && new Date() >= new Date(post.end_at))
  if (effectivelyClosed) {
    return error(res, 'This Q&A board is closed. No new questions can be posted.', 403);
  }

  try {
    const question = await Question.create({
      qna_id: qnaId,
      text: text.trim(),
      author_id: req.user.user_id,
      author_name: req.user.name,
    });

    const result = { ...question.toObject(), liked_by_me: false, likes: undefined };

    // Broadcast to qna room
    try {
      getIO().to(`qna_${qnaId}`).emit('question:new', result);
      getIO().to('qna_global').emit('question:count_change', { qna_id: qnaId, delta: 1 });
    } catch (_) {}

    return success(res, { question: result }, 201);
  } catch (err) {
    return error(res, 'Failed to post question.', 500);
  }
};

// PATCH /api/qna/:qnaId/questions/:qId
const updateQuestion = async (req, res) => {
  const { text } = req.body;
  const { qId } = req.params;

  if (!text || typeof text !== 'string' || !text.trim()) {
    return error(res, 'Question text is required', 400);
  }
  if (text.trim().length > 1000) {
    return error(res, 'Question must be 1000 characters or fewer', 400);
  }

  try {
    const question = await Question.findById(qId);
    if (!question || question.is_deleted) return error(res, 'Question not found', 404);

    const isOwner = question.author_id.toString() === req.user.user_id;
    if (!isOwner && req.user.role !== 'admin') {
      return error(res, 'Not authorized', 403);
    }

    question.text = text.trim();
    question.updated_at = new Date();
    await question.save();

    const result = {
      ...question.toObject(),
      liked_by_me: question.likes.some((id) => id.toString() === req.user.user_id),
      likes: undefined,
    };

    try {
      getIO().to(`qna_${req.params.qnaId}`).emit('question:update', result);
    } catch (_) {}

    return success(res, { question: result });
  } catch (err) {
    return error(res, 'Failed to update question.', 500);
  }
};

// DELETE /api/qna/:qnaId/questions/:qId
const deleteQuestion = async (req, res) => {
  const { qId } = req.params;

  try {
    const question = await Question.findById(qId);
    if (!question || question.is_deleted) return error(res, 'Question not found', 404);

    const isOwner = question.author_id.toString() === req.user.user_id;
    if (!isOwner && req.user.role !== 'admin') {
      return error(res, 'Not authorized', 403);
    }

    question.is_deleted = true;
    await question.save();

    try {
      getIO().to(`qna_${req.params.qnaId}`).emit('question:delete', { question_id: qId });
      getIO().to('qna_global').emit('question:count_change', { qna_id: req.params.qnaId, delta: -1 });
    } catch (_) {}

    return success(res, { message: 'Question deleted' });
  } catch (err) {
    return error(res, 'Failed to delete question.', 500);
  }
};

// PATCH /api/qna/:qnaId/questions/:qId/like
const toggleLike = async (req, res) => {
  const { qId } = req.params;
  const userId = req.user.user_id;

  try {
    const qnaPost = req.qnaPost
    if (qnaPost?.status === 'CLOSED' || (qnaPost?.end_at && new Date() >= new Date(qnaPost.end_at))) {
      return error(res, 'This Q&A board is closed.', 403);
    }

    const question = await Question.findById(qId).select('likes is_deleted').lean();
    if (!question || question.is_deleted) return error(res, 'Question not found', 404);

    const alreadyLiked = question.likes.some((id) => id.toString() === userId);

    const updated = await Question.findByIdAndUpdate(
      qId,
      alreadyLiked
        ? { $pull: { likes: new mongoose.Types.ObjectId(userId) }, $inc: { likes_count: -1 } }
        : { $addToSet: { likes: new mongoose.Types.ObjectId(userId) }, $inc: { likes_count: 1 } },
      { new: true, select: 'likes_count' }
    );

    try {
      getIO().to(`qna_${req.params.qnaId}`).emit('question:like', {
        question_id: qId,
        likes_count: updated.likes_count,
      });
    } catch (_) {}

    return success(res, {
      likes_count: updated.likes_count,
      liked_by_me: !alreadyLiked,
    });
  } catch (err) {
    return error(res, 'Failed to update like.', 500);
  }
};

module.exports = { listQuestions, createQuestion, updateQuestion, deleteQuestion, toggleLike };
