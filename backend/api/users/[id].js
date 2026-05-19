const supabase = require('../_lib/supabase');
const { withRole } = require('../_lib/roleGuard');
const { sendSuccess, sendError, handleCors, formatUser } = require('../_lib/response');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function updateUser(req, res, adminUser) {
  const { id } = req.query;
  if (!id || !UUID_RE.test(id)) return sendError(res, 'Invalid user ID', 400);

  const { name, is_active, role } = req.body || {};
  const updates = {};

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) {
      return sendError(res, 'Name must be between 2 and 80 characters', 400);
    }
    updates.name = name.trim();
  }
  if (is_active !== undefined) {
    if (typeof is_active !== 'boolean') return sendError(res, 'is_active must be a boolean', 400);
    updates.is_active = is_active;
  }
  if (role !== undefined) {
    if (!['admin', 'user'].includes(role)) return sendError(res, 'Role must be admin or user', 400);
    updates.role = role;
  }
  delete updates.is_root;

  if (Object.keys(updates).length === 0) return sendError(res, 'At least one field must be provided', 400);

  try {
    const { data: target } = await supabase
      .from('users')
      .select('is_root')
      .eq('id', id)
      .maybeSingle();

    if (!target) return sendError(res, 'User not found', 404);

    if (target.is_root) {
      if (updates.is_active === false) return sendError(res, 'Root admin account cannot be deactivated', 403);
      if (updates.role !== undefined) return sendError(res, 'Root admin role cannot be changed', 403);
    }

    const { data: user, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select('id, name, email, role, is_active, is_root, created_at')
      .single();

    if (error) throw error;

    return sendSuccess(res, { user: formatUser(user) });
  } catch (_) {
    return sendError(res, 'Failed to update user', 500);
  }
}

async function deleteUser(req, res, adminUser) {
  const { id } = req.query;
  if (!id || !UUID_RE.test(id)) return sendError(res, 'Invalid user ID', 400);

  if (adminUser.user_id === id) return sendError(res, 'You cannot delete your own account', 400);

  try {
    const { data: target } = await supabase
      .from('users')
      .select('is_root')
      .eq('id', id)
      .maybeSingle();

    if (!target) return sendError(res, 'User not found', 404);
    if (target.is_root) return sendError(res, 'Root admin account cannot be deleted', 403);

    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) throw error;

    return sendSuccess(res, { message: 'User deleted' });
  } catch (_) {
    return sendError(res, 'Failed to delete user', 500);
  }
}

module.exports = function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method === 'PATCH') return withRole('admin', updateUser)(req, res);
  if (req.method === 'DELETE') return withRole('admin', deleteUser)(req, res);

  return sendError(res, 'Method not allowed', 405);
};
