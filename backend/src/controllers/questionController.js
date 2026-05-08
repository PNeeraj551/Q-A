const mongoose = require('mongoose');
const Question = require('../models/Question');
const { getIO } = require('../sockets/io');
const { success, error } = require('../utils/responseUtils');

// GET /api/qna/:qnaId/questions
const listQuestions = async (req, res) => {
  try {
    const { qnaId } = req.params;

    const questions = await Question.find({ qna_id: qnaId, is_deleted: false })
      .sort({ likes_count: -1, created_at: -1 })
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
  if (req.qnaPost?.status === 'CLOSED') {
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

    return success(res, {
      question: {
        ...question.toObject(),
        liked_by_me: question.likes.some((id) => id.toString() === req.user.user_id),
        likes: undefined,
      },
    });
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

    return success(res, {
      likes_count: updated.likes_count,
      liked_by_me: !alreadyLiked,
    });
  } catch (err) {
    return error(res, 'Failed to update like.', 500);
  }
};

module.exports = { listQuestions, createQuestion, updateQuestion, deleteQuestion, toggleLike };
