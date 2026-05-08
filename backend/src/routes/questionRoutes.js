const express = require('express');
const router = express.Router({ mergeParams: true });
const authMiddleware = require('../middleware/authMiddleware');
const qnaAccessGuard = require('../middleware/qnaAccessGuard');
const { listQuestions, createQuestion, updateQuestion, deleteQuestion, toggleLike } = require('../controllers/questionController');

const withAccess = [authMiddleware, qnaAccessGuard];
const authenticated = [authMiddleware];

router.get('/', withAccess, listQuestions);
router.post('/', withAccess, createQuestion);
router.patch('/:qId', authenticated, updateQuestion);
router.delete('/:qId', authenticated, deleteQuestion);
router.patch('/:qId/like', withAccess, toggleLike);

module.exports = router;
