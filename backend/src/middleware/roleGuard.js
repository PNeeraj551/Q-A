const { error } = require('../utils/responseUtils');

const roleGuard = (requiredRole) => {
  return (req, res, next) => {
    if (!req.user || req.user.role !== requiredRole) {
      return error(res, `Forbidden: ${requiredRole} access required`, 403);
    }
    next();
  };
};

module.exports = roleGuard;
