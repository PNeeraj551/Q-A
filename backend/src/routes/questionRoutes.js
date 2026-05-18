const express = require('express');
const router = express.Router({ mergeParams: true });
const authMiddleware = require('../middlewares/authMiddleware');
const qnaAccessGuard = require('../middlewares/qnaAccessGuard');
const { listQuestions, createQuestion, updateQuestion, deleteQuestion, toggleLike, markAcceptedReply, trackView } = require('../controllers/questionController');

const withAccess = [authMiddleware, qnaAccessGuard];
const authenticated = [authMiddleware];

router.get('/', withAccess, listQuestions);
router.post('/', withAccess, createQuestion);
router.patch('/:qId', authenticated, updateQuestion);
router.delete('/:qId', authenticated, deleteQuestion);
router.patch('/:qId/like', withAccess, toggleLike);
router.patch('/:qId/accept-reply', authenticated, markAcceptedReply);
router.patch('/:qId/view', authenticated, trackView);

module.exports = router;
