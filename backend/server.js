const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const { Server } = require('socket.io');

const connectDB = require('./src/config/db');
const { PORT, CLIENT_URL, NODE_ENV } = require('./src/config/env');

const { setIO } = require('./src/sockets/io');
const { initSocketHandler } = require('./src/sockets/socketHandler');

const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');
const qnaRoutes = require('./src/routes/qnaRoutes');
const questionRoutes = require('./src/routes/questionRoutes');
const replyRoutes = require('./src/routes/replyRoutes');

const errorMiddleware = require('./src/middlewares/errorMiddleware');
const { globalLimiter, authLimiter } = require('./src/middlewares/rateLimitMiddleware');

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
app.use(mongoSanitize({ replaceWith: '_' }));

/* RATE LIMITING */

app.use(globalLimiter);

/* ROOT ROUTES */

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

app.use(errorMiddleware);

/* PROCESS HANDLERS */

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
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
    await connectDB();
    httpServer.listen(PORT, () => {
      console.log(`[server] Running on port ${PORT}`);
    });
  } catch (err) {
    console.error('[startup error]', err);
    process.exit(1);
  }
};

startServer();
