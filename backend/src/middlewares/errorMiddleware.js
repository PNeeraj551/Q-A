const { NODE_ENV } = require('../config/env');

const errorMiddleware = (err, req, res, next) => {
  if (NODE_ENV !== 'production') console.error('[error]', err);
  const statusCode = err.statusCode || err.status || 500;
  return res.status(statusCode).json({
    success: false,
    error: NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
};

module.exports = errorMiddleware;
