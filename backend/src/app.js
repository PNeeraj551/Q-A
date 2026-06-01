'use strict';
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const { CLIENT_URL, NODE_ENV } = require('./config/env');
const { requestIdMiddleware } = require('./middlewares/requestId');
const authRoutes = require('./routes/authRoutes');
const qnaRoutes = require('./routes/qnaRoutes');
const questionRoutes = require('./routes/questionRoutes');
const replyRoutes = require('./routes/replyRoutes');
const userAccessRoutes = require('./routes/userAccessRoutes');
const userManagementRoutes = require('./routes/userManagementRoutes');
const errorMiddleware = require('./middlewares/errorMiddleware');
const errorLogger = require('./middlewares/errorLogger');
const requestLogger = require('./middlewares/requestLogger');
const { globalLimiter, authLimiter } = require('./middlewares/rateLimitMiddleware');

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

const allowedOrigin = CLIENT_URL.replace(/\/$/, '');
app.use(helmet({ crossOriginResourcePolicy: false }));

const corsOptions = {
  origin: allowedOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(cookieParser());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestIdMiddleware);
app.use(requestLogger);

app.get('/', (req, res) =>
  res.status(200).json({ success: true, service: 'Q&A Platform API', environment: NODE_ENV, timestamp: new Date().toISOString() })
);
app.get('/health', (req, res) =>
  res.status(200).json({ success: true, status: 'healthy', uptime: process.uptime(), timestamp: new Date().toISOString() })
);

app.use(globalLimiter);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api', userAccessRoutes);
app.use('/api/qna', qnaRoutes);
app.use('/api/qna/:qnaId/questions', questionRoutes);
app.use('/api/qna/:qnaId/questions/:qId/replies', replyRoutes);
app.use('/api/admin/users', userManagementRoutes);

app.use('*', (req, res) => res.status(404).json({ success: false, error: 'Route not found' }));
app.use(errorLogger);
app.use(errorMiddleware);

module.exports = app;
