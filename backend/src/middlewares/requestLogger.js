const logger = require('../utils/logger');

module.exports = function requestLogger(req, res, next) {
  req.startTime = Date.now();

  res.on('finish', () => {
    const ms = Date.now() - req.startTime;
    const status = res.statusCode;
    const ip = req.ip || req.socket?.remoteAddress || '-';
    const msg = `${req.method} ${req.originalUrl} ${status} ${ms}ms ${ip}`;

    if (status >= 500) {
      logger.error(msg);
    } else if (status >= 400) {
      logger.warn(msg);
    } else {
      logger.info(msg);
    }
  });

  next();
};
