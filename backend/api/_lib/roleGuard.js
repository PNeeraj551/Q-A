const { withAuth } = require('./auth');
const { sendError } = require('./response');

// withRole('admin', handler) — requires authenticated user with the given role
function withRole(requiredRole, handler) {
  return withAuth((req, res, user) => {
    if (user.role !== requiredRole) {
      return sendError(res, `Forbidden: ${requiredRole} access required`, 403);
    }
    return handler(req, res, user);
  });
}

module.exports = { withRole };
