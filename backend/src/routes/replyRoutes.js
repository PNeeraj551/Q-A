const express = require('express');
const router = express.Router({ mergeParams: true });
const authMiddleware = require('../middlewares/authMiddleware');
const withBoardSession = require('../middlewares/withBoardSession');
const { listReplies, createReply, updateReply, deleteReply, toggleLike } = require('../controllers/replyController');

// JWT-only (edit/delete require proven identity)
const authenticated = [authMiddleware];

// Accepts JWT or session token
router.get('/', withBoardSession, listReplies);
router.post('/', withBoardSession, createReply);
router.patch('/:rId/like', withBoardSession, toggleLike);
router.patch('/:rId', authenticated, updateReply);
router.delete('/:rId', authenticated, deleteReply);

module.exports = router;
