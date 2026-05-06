const mongoose = require('mongoose');
const Comment = require('../models/Comment');
const ModerationLog = require('../models/ModerationLog');
const { success, error } = require('../utils/responseUtils');

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const hideComment = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return error(res, 'Invalid comment id', 400);
    }

    const comment = await Comment.findOne({ _id: id, is_deleted: false }).lean();
    if (!comment) {
      return error(res, 'Comment not found', 404);
    }

    const newHidden = !comment.is_hidden;

    await Comment.findByIdAndUpdate(id, {
      $set: { is_hidden: newHidden, updated_at: new Date() },
    });

    await ModerationLog.create({
      session_id: comment.session_id,
      comment_id: id,
      action_by: req.user.user_id,
      action_type: newHidden ? 'HIDE' : 'UNHIDE',
    });

    try {
      const { getIO } = require('../sockets/io');
      getIO().to(`session_${comment.session_id}`).emit('comment:hidden', {
        comment_id: id,
        is_hidden: newHidden,
      });
    } catch (_) {}

    return success(res, {
      message: newHidden ? 'Comment hidden' : 'Comment unhidden',
      comment_id: id,
      is_hidden: newHidden,
    });
  } catch (err) {
    return error(res, 'Internal server error', 500);
  }
};

const deleteComment = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return error(res, 'Invalid comment id', 400);
    }

    const comment = await Comment.findOne({ _id: id, is_deleted: false }).lean();
    if (!comment) {
      return error(res, 'Comment not found', 404);
    }

    await Comment.findByIdAndUpdate(id, {
      $set: { is_deleted: true, updated_at: new Date() },
    });

    await ModerationLog.create({
      session_id: comment.session_id,
      comment_id: id,
      action_by: req.user.user_id,
      action_type: 'DELETE',
    });

    try {
      const { getIO } = require('../sockets/io');
      getIO().to(`session_${comment.session_id}`).emit('comment:deleted', {
        comment_id: id,
      });
    } catch (_) {}

    return success(res, {
      message: 'Comment deleted',
      comment_id: id,
    });
  } catch (err) {
    return error(res, 'Internal server error', 500);
  }
};

const pinComment = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return error(res, 'Invalid comment id', 400);
    }

    const comment = await Comment.findOne({ _id: id, is_deleted: false }).lean();
    if (!comment) {
      return error(res, 'Comment not found', 404);
    }

    const newPinned = !comment.admin_pinned;

    await Comment.findByIdAndUpdate(id, {
      $set: { admin_pinned: newPinned, updated_at: new Date() },
    });

    await ModerationLog.create({
      session_id: comment.session_id,
      comment_id: id,
      action_by: req.user.user_id,
      action_type: newPinned ? 'PIN' : 'UNPIN',
    });

    try {
      const { getIO } = require('../sockets/io');
      getIO().to(`session_${comment.session_id}`).emit('comment:pinned', {
        comment_id: id,
        admin_pinned: newPinned,
      });
    } catch (_) {}

    return success(res, {
      message: newPinned ? 'Comment pinned' : 'Comment unpinned',
      comment_id: id,
      admin_pinned: newPinned,
    });
  } catch (err) {
    return error(res, 'Internal server error', 500);
  }
};

const likeComment = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return error(res, 'Invalid comment id', 400);
    }

    const comment = await Comment.findOne({ _id: id, is_deleted: false }).lean();
    if (!comment) {
      return error(res, 'Comment not found', 404);
    }

    const userId = req.user.user_id;
    const alreadyLiked = (comment.liked_by || []).map(String).includes(String(userId));

    if (alreadyLiked) {
      await Comment.findByIdAndUpdate(id, { $pull: { liked_by: userId } });
    } else {
      await Comment.findByIdAndUpdate(id, { $addToSet: { liked_by: userId } });
    }

    const updated = await Comment.findById(id).select('liked_by session_id').lean();
    const updatedLikedBy = updated.liked_by || [];
    const liked_by_ids = updatedLikedBy.map(String);
    const like_count = liked_by_ids.length;

    try {
      const { getIO } = require('../sockets/io');
      getIO().to(`session_${comment.session_id}`).emit('comment:liked', {
        comment_id: id,
        liked_by_ids,
        like_count,
      });
    } catch (_) {}

    return success(res, {
      comment_id: id,
      liked_by_ids,
      like_count,
    });
  } catch (err) {
    return error(res, 'Internal server error', 500);
  }
};

module.exports = { hideComment, deleteComment, pinComment, likeComment };
