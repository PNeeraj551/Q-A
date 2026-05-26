const UserSession = require('../models/UserSession');
const { error } = require('../utils/responseUtils');
const logger = require('../utils/logger');

// Validates X-Session-Token header and attaches req.userSession
const userSessionMiddleware = async (req, res, next) => {
  const token = req.headers['x-session-token'];
  if (!token) return error(res, 'Session token required', 401);

  try {
    const session = await UserSession.findByToken(token);
    if (!session) return error(res, 'Invalid or expired session', 401);
    req.userSession = session;
    next();
  } catch (err) {
    logger.error('userSessionMiddleware error', { err: err.message });
    return error(res, 'Session validation failed', 401);
  }
};

module.exports = userSessionMiddleware;
