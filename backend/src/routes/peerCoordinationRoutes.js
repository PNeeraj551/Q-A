const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const roleGuard = require('../middleware/roleGuard');
const {
  startCoordination,
  listBySession,
  getCoordination,
  addNote,
  submitQuestion,
  closeCoordination,
} = require('../controllers/peerCoordinationController');

function participantGuard(req, res, next) {
  if (req.user.role === 'admin') {
    return res.status(403).json({ error: 'Participants only' });
  }
  next();
}

router.post('/', authMiddleware, participantGuard, startCoordination);
router.get('/session/:sessionId', authMiddleware, listBySession);
router.get('/:id', authMiddleware, participantGuard, getCoordination);
router.post('/:id/note', authMiddleware, participantGuard, addNote);
router.post('/:id/submit-question', authMiddleware, participantGuard, submitQuestion);
router.patch('/:id/close', authMiddleware, participantGuard, closeCoordination);

module.exports = router;
