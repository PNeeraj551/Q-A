const express = require('express');
const router = express.Router();
const { otpLimiter, authLimiter } = require('../middlewares/rateLimitMiddleware');
const userSessionMiddleware = require('../middlewares/userSessionMiddleware');
const { getBoard, requestJoinOtp, verifyJoinOtp, toggleAnonymous } = require('../controllers/userAccessController');

router.get('/join/:shareCode', getBoard);
router.post('/join/:shareCode/otp', otpLimiter, requestJoinOtp);
router.post('/join/:shareCode/verify', authLimiter, verifyJoinOtp);
router.patch('/join/:shareCode/anonymous', userSessionMiddleware, toggleAnonymous);

module.exports = router;
