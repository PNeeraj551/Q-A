const { verifyToken } = require('./jwt');
const supabase = require('./supabase');
const { sendError } = require('./response');

// withAuth(handler) — verifies JWT, attaches user to call
// handler signature: async (req, res, user) => {}
function withAuth(handler) {
  return async (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'Authorization header required', 401);
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (_) {
      return sendError(res, 'Invalid or expired token', 401);
    }

    try {
      const { data: user } = await supabase
        .from('users')
        .select('id, role, is_root, is_active')
        .eq('id', decoded.user_id)
        .eq('is_active', true)
        .maybeSingle();

      if (!user) return sendError(res, 'Account is inactive or not found', 401);

      const ctx = { ...decoded, role: user.role, is_root: user.is_root };
      return handler(req, res, ctx);
    } catch (_) {
      return sendError(res, 'Authentication failed', 401);
    }
  };
}

module.exports = { withAuth };
