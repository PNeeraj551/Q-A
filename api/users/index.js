const supabase = require('../_lib/supabase');
const { withRole } = require('../_lib/roleGuard');
const { sendSuccess, sendError, handleCors, formatUser } = require('../_lib/response');

const ATHIVA_EMAIL = /^[a-zA-Z0-9._%+-]+@athivatech\.com$/i;

async function getUsers(req, res) {
  try {
    const { search } = req.query;
    let query = supabase
      .from('users')
      .select('id, name, email, role, is_active, is_root, created_at')
      .order('created_at', { ascending: false });

    if (search && typeof search === 'string' && search.trim().length > 0) {
      const term = search.trim();
      query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%`);
    }

    const { data: users, error } = await query;
    if (error) throw error;

    return sendSuccess(res, { users: users.map(formatUser) });
  } catch (_) {
    return sendError(res, 'Failed to retrieve users', 500);
  }
}

async function createUser(req, res) {
  const { name, email, role } = req.body || {};

  if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) {
    return sendError(res, 'Name is required and must be between 2 and 80 characters', 400);
  }
  if (!email || typeof email !== 'string' || !ATHIVA_EMAIL.test(email.trim())) {
    return sendError(res, 'A valid @athivatech.com email address is required', 400);
  }
  if (!role || !['admin', 'user'].includes(role)) {
    return sendError(res, 'Role must be either admin or user', 400);
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .insert({ name: name.trim(), email: email.trim().toLowerCase(), role, is_active: true })
      .select('id, name, email, role, is_active, is_root, created_at')
      .single();

    if (error) {
      if (error.code === '23505') return sendError(res, 'Email already in use', 409);
      throw error;
    }

    return sendSuccess(res, { user: formatUser(user) }, 201);
  } catch (_) {
    return sendError(res, 'Failed to create user', 500);
  }
}

module.exports = function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method === 'GET') return withRole('admin', getUsers)(req, res);
  if (req.method === 'POST') return withRole('admin', createUser)(req, res);

  return sendError(res, 'Method not allowed', 405);
};
