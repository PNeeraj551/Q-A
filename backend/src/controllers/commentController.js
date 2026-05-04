const mongoose = require('mongoose');
const Comment = require('../models/Comment');
const User = require('../models/User');
const { success, error } = require('../utils/responseUtils');

// GET /api/sessions/:id/comments
const getComments = async (req, res) => {
  try {
    const session_id = req.params.id;
    const isAdmin = req.user.role === 'admin';

    let limit = parseInt(req.query.limit, 10);
    if (isNaN(limit) || limit < 1) limit = 50;
    if (limit > 100) limit = 100;

    const before_id = req.query.before_id;

    const filter = { session_id, is_deleted: false };

    if (!isAdmin) {
      filter.is_hidden = false;
    }

    if (before_id) {
      if (!mongoose.Types.ObjectId.isValid(before_id)) {
        return error(res, 'Invalid before_id format', 400);
      }
      filter._id = { $lt: new mongoose.Types.ObjectId(before_id) };
    }

    const comments = await Comment.find(filter)
      .sort({ created_at: -1 })
      .limit(limit)
      .lean();

    return success(res, {
      comments,
      hasMore: comments.length === limit,
    });
  } catch (err) {
    if (err.name === 'CastError') {
      return error(res, 'Invalid ID format', 400);
    }
    return error(res, 'Failed to fetch comments', 500);
  }
};

// POST /api/sessions/:id/comments
const createComment = async (req, res) => {
  try {
    const session_id = req.params.id;
    const session = req.session;
    const isAdmin = req.user.role === 'admin';

    const { comment_text } = req.body;

    if (!comment_text || typeof comment_text !== 'string' || comment_text.trim().length === 0) {
      return error(res, 'comment_text is required', 400);
    }
    if (comment_text.trim().length > 1000) {
      return error(res, 'comment_text cannot exceed 1000 characters', 400);
    }

    if (session.session_status === 'CLOSED') {
      return error(res, 'Cannot post to a closed session', 400);
    }

    if (!isAdmin) {
      const allowedStatuses = ['PRE_SESSION', 'ACTIVE_SESSION'];
      if (!allowedStatuses.includes(session.session_status)) {
        return error(res, 'Session is not currently accepting comments', 400);
      }
    }

    const user = await User.findById(req.user.user_id).select('name').lean();
    const participant_name = user && user.name ? user.name : req.user.email;

    const comment = await Comment.create({
      session_id,
      participant_id: req.user.user_id,
      participant_name,
      comment_text: comment_text.trim(),
      is_admin_comment: isAdmin,
    });

    try {
      const { getIO } = require('../sockets/io');
      getIO().to(`session_${session_id}`).emit('comment:new', { comment });
    } catch (_) {}

    return success(res, { comment }, 201);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const message = Object.values(err.errors).map((e) => e.message).join(', ');
      return error(res, message, 400);
    }
    if (err.name === 'CastError') {
      return error(res, 'Invalid ID format', 400);
    }
    return error(res, 'Failed to create comment', 500);
  }
};

module.exports = { getComments, createComment };
