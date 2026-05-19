const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { Server } = require('socket.io');

const { PORT, CLIENT_URL, NODE_ENV } = require('./src/config/env');
const { verifySmtp } = require('./src/services/emailService');

const { setIO } = require('./src/sockets/io');
const { initSocketHandler } = require('./src/sockets/socketHandler');

const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');
const qnaRoutes = require('./src/routes/qnaRoutes');
const questionRoutes = require('./src/routes/questionRoutes');
const replyRoutes = require('./src/routes/replyRoutes');

const errorMiddleware = require('./src/middlewares/errorMiddleware');
const errorLogger = require('./src/middlewares/errorLogger');
const requestLogger = require('./src/middlewares/requestLogger');
const { globalLimiter, authLimiter } = require('./src/middlewares/rateLimitMiddleware');
const logger = require('./src/utils/logger');

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');

const httpServer = http.createServer(app);

/* SOCKET.IO */

const allowedOrigin = CLIENT_URL.replace(/\/$/, '');

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

setIO(io);
initSocketHandler(io);

/* SECURITY MIDDLEWARE */

app.use(helmet({ crossOriginResourcePolicy: false }));

const corsOptions = {
  origin: allowedOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

/* REQUEST LOGGING */

app.use(requestLogger);

/* ROOT ROUTES (before rate limiting so health checks are never throttled) */

app.get('/', (req, res) =>
  res.status(200).json({
    success: true,
    service: 'Q&A Platform API',
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
  })
);

app.get('/health', (req, res) =>
  res.status(200).json({
    success: true,
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  })
);

/* RATE LIMITING */

app.use(globalLimiter);

/* API ROUTES */

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/qna', qnaRoutes);
app.use('/api/qna/:qnaId/questions', questionRoutes);
app.use('/api/qna/:qnaId/questions/:qId/replies', replyRoutes);

/* 404 HANDLER */

app.use('*', (req, res) =>
  res.status(404).json({ success: false, error: 'Route not found' })
);

/* GLOBAL ERROR HANDLER */

app.use(errorLogger);
app.use(errorMiddleware);

/* PROCESS HANDLERS */

process.on('uncaughtException', (err) => {
  logger.error('[uncaughtException]', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('[unhandledRejection]', { reason });
  httpServer.close(() => process.exit(1));
});

process.on('SIGTERM', () => {
  httpServer.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  httpServer.close(() => process.exit(0));
});

/* SERVER START */

const startServer = async () => {
  try {
    verifySmtp();
    httpServer.listen(PORT, () => {
      logger.info(`[server] Running on port ${PORT} (${NODE_ENV})`);
    });
  } catch (err) {
    logger.error('[startup error]', err);
    process.exit(1);
  }
};

startServer();
