const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
  createGroup,
  getMyGroups,
  getMessages,
  sendMessage,
  leaveGroup,
  submitQuestion,
} = require('../controllers/collaborationController');

function participantGuard(req, res, next) {
  if (req.user.role === 'admin') {
    return res.status(403).json({ error: 'Participants only' });
  }
  next();
}

// Route order matters: /groups/session/:sessionId must come before /groups/:groupId/*
router.post('/groups', authMiddleware, participantGuard, createGroup);
router.get('/groups/session/:sessionId', authMiddleware, participantGuard, getMyGroups);
router.get('/groups/:groupId/messages', authMiddleware, participantGuard, getMessages);
router.post('/groups/:groupId/messages', authMiddleware, participantGuard, sendMessage);
router.post('/groups/:groupId/leave', authMiddleware, participantGuard, leaveGroup);
router.post('/groups/:groupId/submit-question', authMiddleware, participantGuard, submitQuestion);

module.exports = router;
