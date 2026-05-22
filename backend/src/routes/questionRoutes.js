const express = require('express');
const router = express.Router({ mergeParams: true });
const authMiddleware = require('../middlewares/authMiddleware');
const withBoardSession = require('../middlewares/withBoardSession');
const { listQuestions, createQuestion, updateQuestion, deleteQuestion, toggleLike, markAcceptedReply, trackView } = require('../controllers/questionController');

// JWT-only (edit/delete/accept require proven identity)
const authenticated = [authMiddleware];

// Accepts JWT or session token (read, post, like)
router.get('/', withBoardSession, listQuestions);
router.post('/', withBoardSession, createQuestion);
router.patch('/:qId', authenticated, updateQuestion);
router.delete('/:qId', authenticated, deleteQuestion);
router.patch('/:qId/like', withBoardSession, toggleLike);
router.patch('/:qId/accept-reply', authenticated, markAcceptedReply);
router.patch('/:qId/view', withBoardSession, trackView);

module.exports = router;
