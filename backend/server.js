const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');

const connectDB = require('./src/config/db');
const { PORT, CLIENT_URL, NODE_ENV } = require('./src/config/env');

const { setIO } = require('./src/sockets/io');
const { initSocketHandler } = require('./src/sockets/socketHandler');

const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');
const sessionRoutes = require('./src/routes/sessionRoutes');
const moderationRoutes = require('./src/routes/moderationRoutes');
const archiveRoutes = require('./src/routes/archiveRoutes');
const peerCoordinationRoutes = require('./src/routes/peerCoordinationRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');
const collaborationRoutes = require('./src/routes/collaborationRoutes');
const adminRoutes = require('./src/routes/adminRoutes');



const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');

const httpServer = http.createServer(app);


/* SOCKET.IO */

const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

setIO(io);
initSocketHandler(io);


/* SECURITY MIDDLEWARE */

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  })
);

app.options('*', cors());

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

app.use(cookieParser());

app.use(
  mongoSanitize({
    replaceWith: '_',
  })
);


/* RATE LIMITING */

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: NODE_ENV === 'production' ? 100 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests. Please try again later.',
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: NODE_ENV === 'production' ? 20 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many authentication attempts. Please try again later.',
  },
});

app.use(globalLimiter);


/* ROOT ROUTES */

app.get('/', (req, res) => {
  return res.status(200).json({
    success: true,
    service: 'Q&A Platform Backend API',
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (req, res) => {
  return res.status(200).json({
    success: true,
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});


/* API ROUTES */

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/comments', moderationRoutes);
app.use('/api/archive', archiveRoutes);
app.use('/api/peer-coordination', peerCoordinationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/collaboration', collaborationRoutes);
app.use('/api/admin', adminRoutes);


/* 404 HANDLER */


app.use('*', (req, res) => {
  return res.status(404).json({
    success: false,
    error: 'Route not found',
  });
});


/* GLOBAL ERROR HANDLER */


app.use((err, req, res, next) => {
  if (NODE_ENV !== 'production') {
    console.error('[error]', err);
  }

  const statusCode = err.statusCode || err.status || 500;

  return res.status(statusCode).json({
    success: false,
    error:
      NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message,
  });
});


/* PROCESS HANDLERS */


process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);

  httpServer.close(() => {
    process.exit(1);
  });
});

process.on('SIGTERM', () => {
  console.log('[server] SIGTERM received. Gracefully shutting down...');

  httpServer.close(() => {
    console.log('[server] Process terminated.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[server] SIGINT received. Gracefully shutting down...');

  httpServer.close(() => {
    console.log('[server] Process terminated.');
    process.exit(0);
  });
});


/* SERVER START */


const startServer = async () => {
  try {
    await connectDB();

    httpServer.listen(PORT, () => {
      console.log(
        `[server] Running on port ${PORT} in ${NODE_ENV} mode`
      );
    });

    console.log('[cron] Lifecycle cron started');
    console.log('[cron] Reminder cron started');
  } catch (err) {
    console.error('[startup error]', err);
    process.exit(1);
  }
};

startServer();