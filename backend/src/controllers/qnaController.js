const db = require('../config/supabase');
const QnaPost = require('../models/QnaPost');
const Question = require('../models/Question');
const User = require('../models/User');
const { success, error } = require('../utils/responseUtils');
const { broadcastToChannel } = require('../utils/broadcast');

const QNA_COLS = 'id, title, description, visibility, status, created_by, end_at, created_at, updated_at';

// GET /api/qna
const listQna = async (req, res) => {
  try {
    const { search, visibility, page = 1, limit = 10, fromDate, toDate } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    let query = db.from('qna_posts').select(QNA_COLS, { count: 'exact' });

    // Access filter for non-admins
    if (req.user.role !== 'admin') {
      const allowedIds = await QnaPost.getUserAllowedQnaIds(req.user.user_id);
      if (allowedIds.length > 0) {
        query = query.or(`visibility.eq.PUBLIC,and(visibility.eq.PRIVATE,id.in.(${allowedIds.join(',')}))`);
      } else {
        query = query.eq('visibility', 'PUBLIC');
      }
    }

    if (search && search.trim()) {
      query = query.ilike('title', `%${search.trim()}%`);
    }
    if (visibility && ['PUBLIC', 'PRIVATE'].includes(visibility)) {
      query = query.eq('visibility', visibility);
    }
    if (fromDate) {
      const from = new Date(fromDate);
      if (!isNaN(from.getTime())) query = query.gte('created_at', from.toISOString());
    }
    if (toDate) {
      const to = new Date(toDate);
      if (!isNaN(to.getTime())) {
        to.setHours(23, 59, 59, 999);
        query = query.lte('created_at', to.toISOString());
      }
    }

    const { data: posts, count: total, error: err } = await query
      .order('created_at', { ascending: false })
      .range(skip, skip + limitNum - 1);

    if (err) throw err;

    // Fetch question counts for this page of posts
    const postIds = (posts || []).map((p) => p.id);
    let countMap = {};
    if (postIds.length > 0) {
      const { data: qs } = await db.from('questions').select('qna_id').in('qna_id', postIds).eq('is_deleted', false);
      (qs || []).forEach((q) => { countMap[q.qna_id] = (countMap[q.qna_id] || 0) + 1; });
    }

    const result = (posts || []).map((p) => ({
      ...p,
      question_count: countMap[p.id] || 0,
      is_effectively_closed: p.status === 'CLOSED' || (p.end_at && new Date() >= new Date(p.end_at)),
    }));

    return success(res, {
      posts: result,
      total: total || 0,
      page: pageNum,
      totalPages: Math.ceil((total || 0) / limitNum),
    });
  } catch (err) {
    return error(res, 'Failed to load Q&A posts.', 500);
  }
};

// GET /api/qna/:id
const getQna = async (req, res) => {
  try {
    const post = req.qnaPost;
    const question_count = await Question.countByQnaId(post.id);

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

  if (end_at != null) {
    const endDate = new Date(end_at);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (isNaN(endDate.getTime()) || endDate < today) {
      return error(res, 'Close date cannot be in the past.', 400);
    }
  }

  try {
    const post = await QnaPost.create({
      title: title.trim(),
      description: (description || '').trim(),
      visibility,
      end_at: end_at ? new Date(end_at).toISOString() : null,
      created_by: req.user.user_id,
    });

    // Insert allowed_users into junction table for PRIVATE boards
    if (visibility === 'PRIVATE' && Array.isArray(allowed_users) && allowed_users.length > 0) {
      await QnaPost.setAllowedUsers(post.id, allowed_users);
    }

    await broadcastToChannel('qna_global', 'qna:new', { post: { ...post, question_count: 0 } });

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

    const updates = {};

    if (title !== undefined) {
      const trimmed = (title || '').trim();
      if (!trimmed) return error(res, 'Title is required', 400);
      if (trimmed.length > 120) return error(res, 'Title must be 120 characters or fewer', 400);
      updates.title = trimmed;
    }

    if (description !== undefined) {
      updates.description = (description || '').trim();
    }

    if (visibility !== undefined) {
      if (!['PUBLIC', 'PRIVATE'].includes(visibility)) {
        return error(res, 'Visibility must be PUBLIC or PRIVATE', 400);
      }
      updates.visibility = visibility;
    }

    if (status !== undefined) {
      if (!['OPEN', 'CLOSED'].includes(status)) {
        return error(res, 'Status must be OPEN or CLOSED', 400);
      }
      updates.status = status;
    }

    if (end_at !== undefined) {
      if (end_at != null) {
        const endDate = new Date(end_at);
        const createdDay = new Date(post.created_at); createdDay.setHours(0, 0, 0, 0);
        if (isNaN(endDate.getTime()) || endDate < createdDay) {
          return error(res, 'Close date cannot be before the Q&A creation date.', 400);
        }
        updates.end_at = endDate.toISOString();
      } else {
        updates.end_at = null;
      }
    }

    const updated = await QnaPost.updateById(post.id, updates);

    // Update allowed_users if provided
    if (allowed_users !== undefined && Array.isArray(allowed_users)) {
      await QnaPost.setAllowedUsers(post.id, allowed_users);
    }

    await broadcastToChannel('qna_global', 'qna:updated', { post: updated });

    return success(res, { post: updated });
  } catch (err) {
    return error(res, 'Failed to update Q&A post.', 500);
  }
};

// DELETE /api/qna/:id
const deleteQna = async (req, res) => {
  try {
    const post = await QnaPost.findById(req.params.id);
    if (!post) return error(res, 'Q&A not found', 404);

    const { data: qs } = await db.from('questions').select('id').eq('qna_id', post.id);
    const qIds = (qs || []).map((q) => q.id);
    await Promise.all([
      qIds.length > 0 ? db.from('question_likes').delete().in('question_id', qIds) : Promise.resolve(),
      db.from('replies').delete().eq('qna_id', post.id),
    ]);
    await db.from('questions').delete().eq('qna_id', post.id);
    await db.from('qna_allowed_users').delete().eq('qna_id', post.id);
    await QnaPost.deleteById(post.id);

    await broadcastToChannel('qna_global', 'qna:deleted', { qna_id: post.id });

    return success(res, { message: 'Q&A post deleted' });
  } catch (err) {
    return error(res, 'Failed to delete Q&A post.', 500);
  }
};

// GET /api/qna/:id/users
const getUsers = async (req, res) => {
  try {
    const post = await QnaPost.findById(req.params.id);
    if (!post) return error(res, 'Q&A not found', 404);

    const allowedIds = await QnaPost.getAllowedUserIds(req.params.id);
    const users = await User.findByIds(allowedIds);

    return success(res, { users });
  } catch (err) {
    return error(res, 'Failed to load users.', 500);
  }
};

// POST /api/qna/:id/users
const addUser = async (req, res) => {
  const { userId } = req.body;

  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    return error(res, 'Valid userId is required', 400);
  }

  try {
    const [post, user] = await Promise.all([
      QnaPost.findById(req.params.id),
      User.findById(userId),
    ]);
    if (!post) return error(res, 'Q&A not found', 404);
    if (!user || !user.is_active) return error(res, 'User not found', 404);

    await QnaPost.addUser(req.params.id, userId);

    return success(res, { message: 'User added' });
  } catch (err) {
    return error(res, 'Failed to add user.', 500);
  }
};

// DELETE /api/qna/:id/users/:userId
const removeUser = async (req, res) => {
  const { userId } = req.params;

  try {
    const post = await QnaPost.findById(req.params.id);
    if (!post) return error(res, 'Q&A not found', 404);

    await QnaPost.removeUser(req.params.id, userId);

    return success(res, { message: 'User removed' });
  } catch (err) {
    return error(res, 'Failed to remove user.', 500);
  }
};

module.exports = { listQna, getQna, createQna, updateQna, deleteQna, getUsers, addUser, removeUser };
