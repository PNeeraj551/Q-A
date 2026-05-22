const { verifyToken } = require('../utils/jwtUtils');
const User = require('../models/User');
const UserSession = require('../models/UserSession');
const QnaPost = require('../models/QnaPost');
const { error } = require('../utils/responseUtils');

// Accepts either JWT (admin/user) or X-Session-Token (public participant).
// Attaches req.user OR req.userSession, and req.qnaPost.
const withBoardSession = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const sessionToken = req.headers['x-session-token'];
  const { qnaId } = req.params;

  // ── JWT path ──────────────────────────────────────────────────────
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch {
      return error(res, 'Invalid or expired token', 401);
    }

    if ('is_active' in decoded) {
      if (!decoded.is_active) return error(res, 'Account is inactive', 401);
      req.user = decoded;
    } else {
      try {
        const user = await User.findById(decoded.user_id);
        if (!user || !user.is_active) return error(res, 'Account is inactive or not found', 401);
        req.user = { ...decoded, role: user.role, is_root: user.is_root };
      } catch {
        return error(res, 'Authentication failed', 401);
      }
    }

    if (qnaId) {
      try {
        const post = await QnaPost.findById(qnaId);
        if (!post) return error(res, 'Board not found', 404);
        req.qnaPost = post;
      } catch {
        return error(res, 'Board not found', 404);
      }
    }
    return next();
  }

  // ── Session token path ────────────────────────────────────────────
  if (sessionToken) {
    try {
      const session = await UserSession.findByToken(sessionToken);
      if (!session) return error(res, 'Invalid or expired session', 401);

      // Ensure session belongs to the requested board
      if (qnaId && session.qna_id !== qnaId) {
        return error(res, 'Session not valid for this board', 403);
      }

      const post = await QnaPost.findById(session.qna_id);
      if (!post) return error(res, 'Board not found', 404);

      req.userSession = session;
      req.qnaPost = post;
      return next();
    } catch {
      return error(res, 'Session validation failed', 401);
    }
  }

  return error(res, 'Authentication required', 401);
};

module.exports = withBoardSession;
