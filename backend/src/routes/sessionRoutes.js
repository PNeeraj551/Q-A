const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const roleGuard = require('../middleware/roleGuard');
const sessionAccessGuard = require('../middleware/sessionAccessGuard');
const commentRoutes = require('./commentRoutes');
const {
  getSessions,
  createSession,
  getSessionById,
  updateSession,
  deleteSession,
  updateSessionStatus,
  getParticipants,
  addParticipant,
  removeParticipant,
} = require('../controllers/sessionController');

router.get('/', authMiddleware, getSessions);
router.post('/', authMiddleware, roleGuard('admin'), createSession);
router.get('/:id', authMiddleware, sessionAccessGuard, getSessionById);
router.patch('/:id', authMiddleware, roleGuard('admin'), updateSession);
router.delete('/:id', authMiddleware, roleGuard('admin'), deleteSession);
router.patch('/:id/status', authMiddleware, roleGuard('admin'), updateSessionStatus);
router.get('/:id/participants', authMiddleware, roleGuard('admin'), getParticipants);
router.post('/:id/participants', authMiddleware, roleGuard('admin'), addParticipant);
router.delete('/:id/participants/:uid', authMiddleware, roleGuard('admin'), removeParticipant);

router.use('/:id/comments', authMiddleware, sessionAccessGuard, commentRoutes);

module.exports = router;
