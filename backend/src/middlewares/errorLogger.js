const logger = require('../utils/logger');

const NODE_ENV = process.env.NODE_ENV || 'development';

module.exports = function errorLogger(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  logger.error(`${req.method} ${req.originalUrl} ${status} — ${err.message}`, {
    ...(NODE_ENV !== 'production' && err.stack ? { stack: err.stack } : {}),
  });
  next(err);
};
