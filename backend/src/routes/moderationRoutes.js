const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const roleGuard = require('../middleware/roleGuard');
const { hideComment, deleteComment, pinComment, likeComment } = require('../controllers/moderationController');

router.patch('/:id/hide', authMiddleware, roleGuard('admin'), hideComment);
router.patch('/:id/delete', authMiddleware, roleGuard('admin'), deleteComment);
router.patch('/:id/pin', authMiddleware, roleGuard('admin'), pinComment);
router.patch('/:id/like', authMiddleware, likeComment);

module.exports = router;
