const app = require('./src/app');
const { PORT, NODE_ENV } = require('./src/config/env');
const { verifySmtp } = require('./src/services/emailService');
const logger = require('./src/utils/logger');

process.on('uncaughtException', (err) => {
  logger.error('[uncaughtException]', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('[unhandledRejection]', { reason });
  process.exit(1);
});

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));

const startServer = () => {
  app.listen(PORT, () => {
    logger.info(`[server] Running on port ${PORT} (${NODE_ENV})`);
    verifySmtp().catch((err) =>
      logger.warn('[startup] SMTP verification failed', { message: err.message })
    );
  });
};

startServer();
