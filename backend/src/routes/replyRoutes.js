const express = require('express');
const router = express.Router({ mergeParams: true });
const authMiddleware = require('../middleware/authMiddleware');
const qnaAccessGuard = require('../middleware/qnaAccessGuard');
const { listReplies, createReply, updateReply, deleteReply } = require('../controllers/replyController');

const withAccess = [authMiddleware, qnaAccessGuard];
const authenticated = [authMiddleware];

router.get('/', withAccess, listReplies);
router.post('/', withAccess, createReply);
router.patch('/:rId', authenticated, updateReply);
router.delete('/:rId', authenticated, deleteReply);

module.exports = router;
