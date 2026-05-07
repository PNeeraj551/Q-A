const http = require('http');
const { PORT, CLIENT_URL, NODE_ENV } = require('./src/config/env');
const connectDB = require('./src/config/db');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
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
const { startLifecycleCron } = require('./src/cron/lifecycleCron');
const { startReminderCron } = require('./src/cron/reminderCron');

const app = express();
app.set('trust proxy', 1);
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: { origin: CLIENT_URL, methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],
});
setIO(io);
initSocketHandler(io);

app.use(helmet());

app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  })
);

app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());
app.use(mongoSanitize());

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: NODE_ENV === 'production' ? 20 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

app.use(globalLimiter);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/comments', moderationRoutes);
app.use('/api/archive', archiveRoutes);
app.use('/api/peer-coordination', peerCoordinationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/collaboration', collaborationRoutes);
app.use('/api/admin', adminRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  if (NODE_ENV !== 'production') {
    console.error('[error]', err);
  }
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
  process.exit(1);
});

const start = async () => {
  await connectDB();
  httpServer.listen(PORT, () => {
    console.log(`[server] Running on port ${PORT} (${NODE_ENV})`);
  });
  startLifecycleCron();
  startReminderCron();
};

start();
