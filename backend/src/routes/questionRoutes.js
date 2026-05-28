const express = require('express');
const router = express.Router({ mergeParams: true });
const authMiddleware = require('../middlewares/authMiddleware');
const roleGuard = require('../middlewares/roleGuard');
const withBoardSession = require('../middlewares/withBoardSession');

const { voteLimiter, deviceTokenLimiter } = require('../middlewares/rateLimitMiddleware');
const deviceTokenValidator = require('../middlewares/deviceTokenValidator');
const { listQuestions, createQuestion, updateQuestion, deleteQuestion, toggleLike, markAcceptedReply, trackView, markAnsweredInSlack, pushQuestionToSlack, pinQuestion } = require('../controllers/questionController');

const authenticated = [authMiddleware];

router.get('/', listQuestions);
router.post('/', deviceTokenValidator, withBoardSession, createQuestion);
router.patch('/:qId', withBoardSession, updateQuestion);
router.delete('/:qId', withBoardSession, deleteQuestion);
router.patch('/:qId/like', voteLimiter, deviceTokenLimiter, deviceTokenValidator, withBoardSession, toggleLike);
router.patch('/:qId/accept-reply', authenticated, markAcceptedReply);
router.patch('/:qId/view', withBoardSession, trackView);
router.patch('/:qId/slack-answer', authMiddleware, roleGuard('admin'), markAnsweredInSlack);
router.post('/:qId/push-slack', authMiddleware, roleGuard('admin'), pushQuestionToSlack);
router.patch('/:qId/pin', authMiddleware, roleGuard('admin'), pinQuestion);

module.exports = router;
