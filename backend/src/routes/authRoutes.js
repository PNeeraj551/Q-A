const express = require('express');
const router = express.Router();
const { requestOtp, verifyOtp, me, logout, updateMe } = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleGuard = require('../middlewares/roleGuard');
const { otpLimiter } = require('../middlewares/rateLimitMiddleware');

router.post('/request-otp', otpLimiter, requestOtp);
router.post('/verify-otp', verifyOtp);
router.get('/me', authMiddleware, me);
router.patch('/me', authMiddleware, roleGuard('admin'), updateMe);
router.post('/logout', authMiddleware, logout);

module.exports = router;
