const mongoose = require('mongoose');
const QnaPost = require('../models/QnaPost');
const Question = require('../models/Question');
const Reply = require('../models/Reply');
const User = require('../models/User');
const { success, error } = require('../utils/responseUtils');
const { getIO } = require('../sockets/io');

// GET /api/qna
// Admin: all posts. User: PUBLIC + assigned PRIVATE.
// Query: ?search=&visibility=&page=1&limit=10
const listQna = async (req, res) => {
  try {
    const { search, visibility, page = 1, limit = 10, fromDate, toDate } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    let accessFilter = {};
    if (req.user.role !== 'admin') {
      accessFilter = {
        $or: [
          { visibility: 'PUBLIC' },
          { visibility: 'PRIVATE', allowed_users: new mongoose.Types.ObjectId(req.user.user_id) },
        ],
      };
    }

    const andClauses = [];
    if (Object.keys(accessFilter).length) andClauses.push(accessFilter);
    if (search && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      andClauses.push({ title: { $regex: escaped, $options: 'i' } });
    }
    if (visibility && ['PUBLIC', 'PRIVATE'].includes(visibility)) {
      andClauses.push({ visibility });
    }
    if (fromDate) {
      const from = new Date(fromDate);
      if (!isNaN(from.getTime())) andClauses.push({ created_at: { $gte: from } });
    }
    if (toDate) {
      const to = new Date(toDate);
      if (!isNaN(to.getTime())) {
        to.setHours(23, 59, 59, 999);
        andClauses.push({ created_at: { $lte: to } });
      }
    }

    const filter = andClauses.length > 1 ? { $and: andClauses } : andClauses[0] || {};

    const [posts, total] = await Promise.all([
      QnaPost.find(filter).sort({ created_at: -1 }).skip(skip).limit(limitNum).lean(),
      QnaPost.countDocuments(filter),
    ]);

    const ids = posts.map((p) => p._id);
    const counts = await Question.aggregate([
      { $match: { qna_id: { $in: ids }, is_deleted: false } },
      { $group: { _id: '$qna_id', count: { $sum: 1 } } },
    ]);
    const countMap = {};
    counts.forEach((c) => { countMap[c._id.toString()] = c.count; });

    const result = posts.map((p) => ({
      ...p,
      question_count: countMap[p._id.toString()] || 0,
      is_effectively_closed: p.status === 'CLOSED' || (p.end_at && new Date() >= new Date(p.end_at)),
    }));

    return success(res, {
      posts: result,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    return error(res, 'Failed to load Q&A posts.', 500);
  }
};

// GET /api/qna/:id
const getQna = async (req, res) => {
  try {
    const post = req.qnaPost; // set by qnaAccessGuard

    const question_count = await Question.countDocuments({ qna_id: post._id, is_deleted: false });

    return success(res, {
      post: {
        ...post,
        question_count,
        is_effectively_closed: post.status === 'CLOSED' || (post.end_at && new Date() >= new Date(post.end_at)),
      },
    });
  } catch (err) {
    return error(res, 'Failed to load Q&A post.', 500);
  }
};

// POST /api/qna
const createQna = async (req, res) => {
  const { title, description, visibility, allowed_users, end_at } = req.body;

  if (!title || typeof title !== 'string' || !title.trim()) {
    return error(res, 'Title is required', 400);
  }
  if (title.trim().length > 120) {
    return error(res, 'Title must be 120 characters or fewer', 400);
  }
  if (!visibility || !['PUBLIC', 'PRIVATE'].includes(visibility)) {
    return error(res, 'Visibility must be PUBLIC or PRIVATE', 400);
  }

  try {
    let users = [];
    if (visibility === 'PRIVATE' && Array.isArray(allowed_users)) {
      users = allowed_users.filter((id) =>
        mongoose.Types.ObjectId.isValid(id)
      );
    }

    if (end_at != null) {
      const endDate = new Date(end_at);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      if (isNaN(endDate.getTime()) || endDate < today) {
        return error(res, 'Close date cannot be in the past.', 400);
      }
    }

    const post = await QnaPost.create({
      title: title.trim(),
      description: (description || '').trim(),
      visibility,
      allowed_users: users,
      end_at: end_at ? new Date(end_at) : null,
      created_by: req.user.user_id,
    });

    try { getIO().to('qna_global').emit('qna:new', { post: { ...post.toObject(), question_count: 0 } }) } catch(_) {}

    return success(res, { post }, 201);
  } catch (err) {
    return error(res, 'Failed to create Q&A post.', 500);
  }
};

// PATCH /api/qna/:id
const updateQna = async (req, res) => {
  const { title, description, visibility, allowed_users, status, end_at } = req.body;

  try {
    const post = await QnaPost.findById(req.params.id);
    if (!post) return error(res, 'Q&A not found', 404);

    if (title !== undefined) {
      const trimmed = (title || '').trim();
      if (!trimmed) return error(res, 'Title is required', 400);
      if (trimmed.length > 120) return error(res, 'Title must be 120 characters or fewer', 400);
      post.title = trimmed;
    }

    if (description !== undefined) {
      post.description = (description || '').trim();
    }

    if (visibility !== undefined) {
      if (!['PUBLIC', 'PRIVATE'].includes(visibility)) {
        return error(res, 'Visibility must be PUBLIC or PRIVATE', 400);
      }
      post.visibility = visibility;
    }

    if (allowed_users !== undefined && Array.isArray(allowed_users)) {
      post.allowed_users = allowed_users.filter((id) =>
        mongoose.Types.ObjectId.isValid(id)
      );
    }

    if (status !== undefined) {
      if (!['OPEN', 'CLOSED'].includes(status)) {
        return error(res, 'Status must be OPEN or CLOSED', 400);
      }
      post.status = status;
    }

    if (end_at !== undefined) {
      if (end_at != null) {
        const endDate = new Date(end_at);
        const createdDay = new Date(post.created_at); createdDay.setHours(0, 0, 0, 0);
        if (isNaN(endDate.getTime()) || endDate < createdDay) {
          return error(res, 'Close date cannot be before the Q&A creation date.', 400);
        }
        post.end_at = endDate;
      } else {
        post.end_at = null;
      }
    }

    post.updated_at = new Date();
    await post.save();

    try { getIO().to('qna_global').emit('qna:updated', { post: post.toObject() }) } catch(_) {}

    return success(res, { post });
  } catch (err) {
    return error(res, 'Failed to update Q&A post.', 500);
  }
};

// DELETE /api/qna/:id
const deleteQna = async (req, res) => {
  try {
    const post = await QnaPost.findById(req.params.id);
    if (!post) return error(res, 'Q&A not found', 404);

    const qnaId = post._id;

    // Cascade soft-delete all questions and replies
    await Question.updateMany({ qna_id: qnaId }, { $set: { is_deleted: true } });
    await Reply.updateMany({ qna_id: qnaId }, { $set: { is_deleted: true } });
    await QnaPost.findByIdAndDelete(qnaId);

    try { getIO().to('qna_global').emit('qna:deleted', { qna_id: qnaId.toString() }) } catch(_) {}

    return success(res, { message: 'Q&A post deleted' });
  } catch (err) {
    return error(res, 'Failed to delete Q&A post.', 500);
  }
};

// GET /api/qna/:id/users
const getUsers = async (req, res) => {
  try {
    const post = await QnaPost.findById(req.params.id).lean();
    if (!post) return error(res, 'Q&A not found', 404);

    const users = await User.find({
      _id: { $in: post.allowed_users },
    }).select('_id name email is_active').lean();

    return success(res, { users });
  } catch (err) {
    return error(res, 'Failed to load users.', 500);
  }
};

// POST /api/qna/:id/users
const addUser = async (req, res) => {
  const { userId } = req.body;

  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return error(res, 'Valid userId is required', 400);
  }

  try {
    const [existingPost, user] = await Promise.all([
      QnaPost.findById(req.params.id).lean(),
      User.findOne({ _id: userId, is_active: true }).select('_id').lean(),
    ]);
    if (!existingPost) return error(res, 'Q&A not found', 404);
    if (!user) return error(res, 'User not found', 404);

    await QnaPost.findByIdAndUpdate(req.params.id, {
      $addToSet: { allowed_users: userId },
      $set: { updated_at: new Date() },
    });

    return success(res, { message: 'User added' });
  } catch (err) {
    return error(res, 'Failed to add user.', 500);
  }
};

// DELETE /api/qna/:id/users/:userId
const removeUser = async (req, res) => {
  const { userId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return error(res, 'Invalid user ID', 400);
  }

  try {
    const updated = await QnaPost.findByIdAndUpdate(
      req.params.id,
      {
        $pull: { allowed_users: new mongoose.Types.ObjectId(userId) },
        $set: { updated_at: new Date() },
      },
      { new: true }
    );
    if (!updated) return error(res, 'Q&A not found', 404);

    return success(res, { message: 'User removed' });
  } catch (err) {
    return error(res, 'Failed to remove user.', 500);
  }
};

module.exports = {
  listQna,
  getQna,
  createQna,
  updateQna,
  deleteQna,
  getUsers,
  addUser,
  removeUser,
};
