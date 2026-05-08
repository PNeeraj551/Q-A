const mongoose = require('mongoose');
const QnaPost = require('../models/QnaPost');
const { error } = require('../utils/responseUtils');

const qnaAccessGuard = async (req, res, next) => {
  const qnaId = req.params.id || req.params.qnaId;

  if (!qnaId || !mongoose.Types.ObjectId.isValid(qnaId)) {
    return error(res, 'Q&A not found', 404);
  }

  try {
    const post = await QnaPost.findById(qnaId).lean();

    if (!post) return error(res, 'Q&A not found', 404);

    if (req.user.role === 'admin') {
      req.qnaPost = post;
      return next();
    }

    if (post.visibility === 'PUBLIC') {
      req.qnaPost = post;
      return next();
    }

    // PRIVATE: return 404 — never reveal the post exists to non-assigned users
    const allowed = post.allowed_participants.some(
      (id) => id.toString() === req.user.user_id
    );
    if (!allowed) return error(res, 'Q&A not found', 404);

    req.qnaPost = post;
    next();
  } catch (err) {
    return error(res, 'Q&A not found', 404);
  }
};

module.exports = qnaAccessGuard;
