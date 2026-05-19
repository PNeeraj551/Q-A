const supabase = require('../../_lib/supabase');
const { withAuth } = require('../../_lib/auth');
const { withRole } = require('../../_lib/roleGuard');
const { withQnaAccess } = require('../../_lib/qnaAccess');
const { broadcastToChannel } = require('../../_lib/realtime');
const { sendSuccess, sendError, handleCors, formatPost } = require('../../_lib/response');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getQna(req, res, user, qnaPost) {
  try {
    const { count: question_count } = await supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('qna_id', qnaPost.id)
      .eq('is_deleted', false);

    return sendSuccess(res, {
      post: {
        ...formatPost(qnaPost),
        question_count: question_count || 0,
      },
    });
  } catch (_) {
    return sendError(res, 'Failed to load Q&A post.', 500);
  }
}

async function updateQna(req, res, user) {
  const { qnaId } = req.query;
  if (!qnaId || !UUID_RE.test(qnaId)) return sendError(res, 'Q&A not found', 404);

  const { title, description, visibility, allowed_users, status, end_at } = req.body || {};

  try {
    const { data: existing } = await supabase
      .from('qna_posts')
      .select('id, created_at')
      .eq('id', qnaId)
      .maybeSingle();
    if (!existing) return sendError(res, 'Q&A not found', 404);

    const updates = {};

    if (title !== undefined) {
      const trimmed = (title || '').trim();
      if (!trimmed) return sendError(res, 'Title is required', 400);
      if (trimmed.length > 120) return sendError(res, 'Title must be 120 characters or fewer', 400);
      updates.title = trimmed;
    }
    if (description !== undefined) updates.description = (description || '').trim();
    if (visibility !== undefined) {
      if (!['PUBLIC', 'PRIVATE'].includes(visibility)) return sendError(res, 'Visibility must be PUBLIC or PRIVATE', 400);
      updates.visibility = visibility;
    }
    if (status !== undefined) {
      if (!['OPEN', 'CLOSED'].includes(status)) return sendError(res, 'Status must be OPEN or CLOSED', 400);
      updates.status = status;
    }
    if (end_at !== undefined) {
      if (end_at != null) {
        const endDate = new Date(end_at);
        const createdDay = new Date(existing.created_at); createdDay.setHours(0, 0, 0, 0);
        if (isNaN(endDate.getTime()) || endDate < createdDay) {
          return sendError(res, 'Close date cannot be before the Q&A creation date.', 400);
        }
        updates.end_at = endDate.toISOString();
      } else {
        updates.end_at = null;
      }
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase.from('qna_posts').update(updates).eq('id', qnaId);
      if (error) throw error;
    }

    // Sync allowed_users when provided
    if (Array.isArray(allowed_users)) {
      await supabase.from('qna_allowed_users').delete().eq('qna_id', qnaId);
      const rows = allowed_users
        .filter((id) => typeof id === 'string' && UUID_RE.test(id))
        .map((user_id) => ({ qna_id: qnaId, user_id }));
      if (rows.length > 0) await supabase.from('qna_allowed_users').insert(rows);
    }

    const { data: post } = await supabase
      .from('qna_posts')
      .select('*, qna_allowed_users(user_id)')
      .eq('id', qnaId)
      .single();

    const formatted = formatPost(post);
    broadcastToChannel('qna_global', 'qna:updated', { post: formatted });

    return sendSuccess(res, { post: formatted });
  } catch (err) {
    console.error('[updateQna]', err);
    return sendError(res, 'Failed to update Q&A post.', 500);
  }
}

async function deleteQna(req, res, user) {
  const { qnaId } = req.query;
  if (!qnaId || !UUID_RE.test(qnaId)) return sendError(res, 'Q&A not found', 404);

  try {
    const { data: existing } = await supabase.from('qna_posts').select('id').eq('id', qnaId).maybeSingle();
    if (!existing) return sendError(res, 'Q&A not found', 404);

    // Soft-delete questions and replies, then hard-delete the post
    await supabase.from('questions').update({ is_deleted: true }).eq('qna_id', qnaId);
    await supabase.from('replies').update({ is_deleted: true }).eq('qna_id', qnaId);
    await supabase.from('qna_posts').delete().eq('id', qnaId);

    broadcastToChannel('qna_global', 'qna:deleted', { qna_id: qnaId });

    return sendSuccess(res, { message: 'Q&A post deleted' });
  } catch (err) {
    console.error('[deleteQna]', err);
    return sendError(res, 'Failed to delete Q&A post.', 500);
  }
}

module.exports = function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method === 'GET') return withQnaAccess(getQna)(req, res);
  if (req.method === 'PATCH') return withRole('admin', updateQna)(req, res);
  if (req.method === 'DELETE') return withRole('admin', deleteQna)(req, res);

  return sendError(res, 'Method not allowed', 405);
};
