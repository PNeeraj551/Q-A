const { verifyToken } = require('../utils/jwtUtils');
const { error } = require('../utils/responseUtils');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return error(res, 'Authorization header required', 401);
  }

  const token = authHeader.split(' ')[1];

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch (err) {
    return error(res, 'Invalid or expired token', 401);
  }

  try {
    const user = await User.findById(decoded.user_id);
    if (!user || !user.is_active) {
      return error(res, 'Account is inactive or not found', 401);
    }
    req.user = { ...decoded, role: user.role, is_root: user.is_root };
    next();
  } catch (err) {
    return error(res, 'Authentication failed', 401);
  }
};

module.exports = authMiddleware;
