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

  // Always re-validate against the DB so role/status changes take effect
  // immediately (a demoted or deactivated account cannot ride an old token).
  try {
    const user = await User.findById(decoded.user_id);
    if (!user || user.status !== 'VERIFIED' || user.deleted_at) {
      return error(res, 'Account is inactive or not found', 401);
    }
    req.user = {
      user_id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      is_root: user.is_root,
      status: user.status,
    };
    next();
  } catch (err) {
    logger.error('authMiddleware error', { err: err.message });
    return error(res, 'Authentication failed', 401);
  }
};

module.exports = authMiddleware;
