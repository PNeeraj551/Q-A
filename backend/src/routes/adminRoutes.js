const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const roleGuard = require('../middleware/roleGuard');
const { getPostSessionAnalytics } = require('../controllers/postSessionAnalyticsController');
const { getOverviewAnalytics, getSessionDetailAnalytics } = require('../controllers/adminAnalyticsController');
const { getSessionChats, createChat, sendMessage } = require('../controllers/adminDMController');

router.get('/session-analytics/:sessionId', authMiddleware, roleGuard('admin'), getPostSessionAnalytics);
router.get('/analytics/overview', authMiddleware, roleGuard('admin'), getOverviewAnalytics);
router.get('/analytics/session/:sessionId', authMiddleware, roleGuard('admin'), getSessionDetailAnalytics);
router.get('/dm/:sessionId', authMiddleware, roleGuard('admin'), getSessionChats);
router.post('/dm/:sessionId', authMiddleware, roleGuard('admin'), createChat);
router.post('/dm/:chatId/message', authMiddleware, roleGuard('admin'), sendMessage);

module.exports = router;
