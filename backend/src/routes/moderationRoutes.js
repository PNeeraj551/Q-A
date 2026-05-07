const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const roleGuard = require('../middleware/roleGuard');
const { hideComment, deleteComment, editComment, removeComment, likeComment } = require('../controllers/moderationController');

router.patch('/:id/hide', authMiddleware, roleGuard('admin'), hideComment);
router.patch('/:id/delete', authMiddleware, roleGuard('admin'), deleteComment);
router.patch('/:id/edit', authMiddleware, editComment);
router.patch('/:id/remove', authMiddleware, removeComment);
router.patch('/:id/like', authMiddleware, likeComment);

module.exports = router;
