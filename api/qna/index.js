const supabase = require('../_lib/supabase');
const { withAuth } = require('../_lib/auth');
const { withRole } = require('../_lib/roleGuard');
const { broadcastToChannel } = require('../_lib/realtime');
const { sendSuccess, sendError, handleCors, formatPost } = require('../_lib/response');

async function listQna(req, res, user) {
  try {
    const { search, visibility, page = '1', limit = '10', fromDate, toDate } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const from = (pageNum - 1) * limitNum;
    const to = from + limitNum - 1;

    let query = supabase
      .from('qna_posts')
      .select('*, qna_allowed_users(user_id)', { count: 'exact' });

    if (user.role !== 'admin') {
      // Fetch user's allowed private boards
      const { data: allowed } = await supabase
        .from('qna_allowed_users')
        .select('qna_id')
        .eq('user_id', user.user_id);

      const allowedIds = (allowed || []).map((r) => r.qna_id);

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
      const d = new Date(fromDate);
      if (!isNaN(d.getTime())) query = query.gte('created_at', d.toISOString());
    }
    if (toDate) {
      const d = new Date(toDate);
      if (!isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        query = query.lte('created_at', d.toISOString());
      }
    }

    query = query.order('created_at', { ascending: false }).range(from, to);

    const { data: posts, count, error } = await query;
    if (error) throw error;

    const total = count || 0;

    // Fetch question counts for these posts
    const postIds = posts.map((p) => p.id);
    let questionRows = [];
    if (postIds.length > 0) {
      const { data } = await supabase
        .from('questions')
        .select('qna_id')
        .in('qna_id', postIds)
        .eq('is_deleted', false);
      questionRows = data || [];
    }

    const countMap = {};
    questionRows.forEach((q) => {
      countMap[q.qna_id] = (countMap[q.qna_id] || 0) + 1;
    });

    const result = posts.map((p) => ({
      ...formatPost(p),
      question_count: countMap[p.id] || 0,
    }));

    return sendSuccess(res, {
      posts: result,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    console.error('[listQna]', err);
    return sendError(res, 'Failed to load Q&A posts.', 500);
  }
}

async function createQna(req, res, user) {
  const { title, description, visibility, allowed_users, end_at } = req.body || {};

  if (!title || typeof title !== 'string' || !title.trim()) {
    return sendError(res, 'Title is required', 400);
  }
  if (title.trim().length > 120) return sendError(res, 'Title must be 120 characters or fewer', 400);
  if (!visibility || !['PUBLIC', 'PRIVATE'].includes(visibility)) {
    return sendError(res, 'Visibility must be PUBLIC or PRIVATE', 400);
  }
  if (end_at != null) {
    const endDate = new Date(end_at);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (isNaN(endDate.getTime()) || endDate < today) {
      return sendError(res, 'Close date cannot be in the past.', 400);
    }
  }

  try {
    const { data: post, error } = await supabase
      .from('qna_posts')
      .insert({
        title: title.trim(),
        description: (description || '').trim(),
        visibility,
        created_by: user.user_id,
        end_at: end_at ? new Date(end_at).toISOString() : null,
      })
      .select('id, title, description, visibility, status, created_by, end_at, created_at, updated_at')
      .single();

    if (error) throw error;

    // Add allowed_users for PRIVATE boards
    if (visibility === 'PRIVATE' && Array.isArray(allowed_users) && allowed_users.length > 0) {
      const rows = allowed_users
        .filter((id) => typeof id === 'string' && id.length > 0)
        .map((user_id) => ({ qna_id: post.id, user_id }));
      if (rows.length > 0) await supabase.from('qna_allowed_users').insert(rows);
    }

    const { data: full } = await supabase
      .from('qna_posts')
      .select('*, qna_allowed_users(user_id)')
      .eq('id', post.id)
      .single();

    const formatted = { ...formatPost(full), question_count: 0 };

    broadcastToChannel('qna_global', 'qna:new', { post: formatted });

    return sendSuccess(res, { post: formatted }, 201);
  } catch (err) {
    console.error('[createQna]', err);
    return sendError(res, 'Failed to create Q&A post.', 500);
  }
}

module.exports = function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method === 'GET') return withAuth(listQna)(req, res);
  if (req.method === 'POST') return withRole('admin', createQna)(req, res);

  return sendError(res, 'Method not allowed', 405);
};
