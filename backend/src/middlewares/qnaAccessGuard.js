const db = require('../config/supabase');
const QnaPost = require('../models/QnaPost');
const { error } = require('../utils/responseUtils');

const qnaAccessGuard = async (req, res, next) => {
  const qnaId = req.params.id || req.params.qnaId;

  if (!qnaId) {
    return error(res, 'Q&A not found', 404);
  }

  try {
    const post = await QnaPost.findById(qnaId);

    if (!post) return error(res, 'Q&A not found', 404);

    if (req.user.role === 'admin') {
      req.qnaPost = post;
      return next();
    }

    if (post.visibility === 'PUBLIC') {
      req.qnaPost = post;
      return next();
    }

    // PRIVATE: check junction table — never reveal the post exists to non-assigned users
    const { data } = await db
      .from('qna_allowed_users')
      .select('user_id')
      .eq('qna_id', qnaId)
      .eq('user_id', req.user.user_id)
      .maybeSingle();

    if (!data) return error(res, 'Q&A not found', 404);

    req.qnaPost = post;
    next();
  } catch (err) {
    return error(res, 'Q&A not found', 404);
  }
};

module.exports = qnaAccessGuard;
