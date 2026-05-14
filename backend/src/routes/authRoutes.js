const express = require('express');
const router = express.Router();
const { login, me, logout, updateMe, changePassword } = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');

router.post('/login', login);
router.get('/me', authMiddleware, me);
router.patch('/me', authMiddleware, updateMe);
router.post('/logout', authMiddleware, logout);
router.patch('/change-password', authMiddleware, changePassword);

module.exports = router;
