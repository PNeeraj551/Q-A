const { createLogger, format, transports } = require('winston');
const { getStore } = require('../middlewares/requestId');

const NODE_ENV = process.env.NODE_ENV || 'development';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

const injectRequestId = format((info) => {
  const { requestId } = getStore();
  if (requestId) info.requestId = requestId;
  return info;
})();

const devFormat = format.combine(
  injectRequestId,
  format.colorize(),
  format.timestamp({ format: 'HH:mm:ss' }),
  format.printf(({ timestamp, level, message, requestId, ...meta }) => {
    const rid = requestId ? ` [${requestId.slice(0, 8)}]` : '';
    const extra = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
    return `${timestamp}${rid} ${level}: ${message}${extra}`;
  })
);

const prodFormat = format.combine(
  injectRequestId,
  format.timestamp(),
  format.errors({ stack: true }),
  format.json()
);

const logger = createLogger({
  level: LOG_LEVEL,
  format: NODE_ENV === 'production' ? prodFormat : devFormat,
  transports: [new transports.Console()],
});

module.exports = logger;
