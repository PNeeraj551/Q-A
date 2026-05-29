const { verifyToken } = require('../utils/jwtUtils');
const { error } = require('../utils/responseUtils');
const User = require('../models/User');
const logger = require('../utils/logger');

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = req.cookies?.token ||
    (authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null);

  if (!token) {
    return error(res, 'Authentication required', 401);
  }

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch (err) {
    return error(res, 'Invalid or expired token', 401);
  }

  // Fast path: token has status embedded (new tokens)
  if ('status' in decoded) {
    if (decoded.status !== 'VERIFIED') {
      return error(res, 'Account is inactive or not found', 401);
    }
    req.user = decoded;
    return next();
  }

  // Legacy fast path: token has is_active (tokens issued before status was added)
  if ('is_active' in decoded) {
    if (!decoded.is_active) {
      return error(res, 'Account is inactive or not found', 401);
    }
    // Fall through to DB check to get current status for legacy tokens
  }

  try {
    const user = await User.findById(decoded.user_id);
    if (!user || user.status !== 'VERIFIED' || user.deleted_at) {
      return error(res, 'Account is inactive or not found', 401);
    }
    req.user = { ...decoded, role: user.role, is_root: user.is_root, status: user.status };
    next();
  } catch (err) {
    logger.error('authMiddleware error', { err: err.message });
    return error(res, 'Authentication failed', 401);
  }
};

module.exports = authMiddleware;
