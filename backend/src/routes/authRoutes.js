const express = require('express');
const router = express.Router();
const { login, me, logout, refresh, updateMe, forgotPassword, getResetRequests, adminResetPassword, changePassword } = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const roleGuard = require('../middleware/roleGuard');

router.post('/login', login);
router.post('/refresh', refresh);
router.post('/forgot-password', forgotPassword);
router.get('/reset-requests', authMiddleware, roleGuard('admin'), getResetRequests);
router.get('/me', authMiddleware, me);
router.patch('/me', authMiddleware, updateMe);
router.post('/logout', authMiddleware, logout);
router.patch('/admin-reset-password/:userId', authMiddleware, roleGuard('admin'), adminResetPassword);
router.patch('/change-password', authMiddleware, changePassword);

module.exports = router;
