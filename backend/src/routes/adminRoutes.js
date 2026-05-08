const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const roleGuard = require('../middleware/roleGuard');
const { getAnalytics } = require('../controllers/analyticsController');

const adminOnly = [authMiddleware, roleGuard('admin')];

router.get('/analytics', adminOnly, getAnalytics);

module.exports = router;
