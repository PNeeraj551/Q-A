const supabase = require('../../../_lib/supabase');
const { withRole } = require('../../../_lib/roleGuard');
const { sendSuccess, sendError, handleCors, formatUser } = require('../../../_lib/response');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getBoardUsers(req, res) {
  const { qnaId } = req.query;
  if (!qnaId || !UUID_RE.test(qnaId)) return sendError(res, 'Q&A not found', 404);

  try {
    const { data: post } = await supabase.from('qna_posts').select('id').eq('id', qnaId).maybeSingle();
    if (!post) return sendError(res, 'Q&A not found', 404);

    const { data: rows } = await supabase
      .from('qna_allowed_users')
      .select('users(id, name, email, is_active)')
      .eq('qna_id', qnaId);

    const users = (rows || []).map((r) => formatUser(r.users)).filter(Boolean);
    return sendSuccess(res, { users });
  } catch (_) {
    return sendError(res, 'Failed to load users.', 500);
  }
}

async function addBoardUser(req, res) {
  const { qnaId } = req.query;
  const { userId } = req.body || {};

  if (!qnaId || !UUID_RE.test(qnaId)) return sendError(res, 'Q&A not found', 404);
  if (!userId || !UUID_RE.test(userId)) return sendError(res, 'Valid userId is required', 400);

  try {
    const [{ data: post }, { data: user }] = await Promise.all([
      supabase.from('qna_posts').select('id').eq('id', qnaId).maybeSingle(),
      supabase.from('users').select('id').eq('id', userId).eq('is_active', true).maybeSingle(),
    ]);

    if (!post) return sendError(res, 'Q&A not found', 404);
    if (!user) return sendError(res, 'User not found', 404);

    await supabase
      .from('qna_allowed_users')
      .upsert({ qna_id: qnaId, user_id: userId }, { onConflict: 'qna_id,user_id' });

    return sendSuccess(res, { message: 'User added' });
  } catch (_) {
    return sendError(res, 'Failed to add user.', 500);
  }
}

module.exports = function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method === 'GET') return withRole('admin', getBoardUsers)(req, res);
  if (req.method === 'POST') return withRole('admin', addBoardUser)(req, res);

  return sendError(res, 'Method not allowed', 405);
};
