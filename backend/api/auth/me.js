const supabase = require('../_lib/supabase');
const { withAuth } = require('../_lib/auth');
const { sendSuccess, sendError, handleCors, formatUser } = require('../_lib/response');

const NAME_MAX = 80;

async function getMe(req, res, user) {
  try {
    const { data } = await supabase
      .from('users')
      .select('id, name, email, role, is_active, is_root, created_at')
      .eq('id', user.user_id)
      .maybeSingle();

    if (!data) return sendError(res, 'User not found', 404);
    return sendSuccess(res, formatUser(data));
  } catch (_) {
    return sendError(res, 'Failed to retrieve user profile.', 500);
  }
}

async function updateMe(req, res, user) {
  const { name } = req.body || {};
  try {
    if (name !== undefined) {
      const trimmed = (name || '').trim();
      if (!trimmed) return sendError(res, 'Name is required', 400);
      if (trimmed.length > NAME_MAX) return sendError(res, `Name must be ${NAME_MAX} characters or fewer`, 400);

      const { data: updated } = await supabase
        .from('users')
        .update({ name: trimmed })
        .eq('id', user.user_id)
        .select('id, name, email, role, is_active, is_root, created_at')
        .single();

      return sendSuccess(res, formatUser(updated));
    }

    const { data } = await supabase
      .from('users')
      .select('id, name, email, role, is_active, is_root, created_at')
      .eq('id', user.user_id)
      .maybeSingle();

    return sendSuccess(res, formatUser(data));
  } catch (_) {
    return sendError(res, 'Failed to update profile.', 500);
  }
}

module.exports = function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method === 'GET') return withAuth(getMe)(req, res);
  if (req.method === 'PATCH') return withAuth(updateMe)(req, res);

  return sendError(res, 'Method not allowed', 405);
};
