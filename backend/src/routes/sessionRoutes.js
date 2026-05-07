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
  liveInvite,
  liveRemove,
} = require('../controllers/sessionController');
const { getSessionPresence } = require('../sockets/socketHandler');
const { getSessionAnalytics } = require('../controllers/analyticsController');
const { participantGetChats, participantSendMessage } = require('../controllers/adminDMController');

router.get('/', authMiddleware, getSessions);
router.post('/', authMiddleware, roleGuard('admin'), createSession);
router.get('/:id', authMiddleware, sessionAccessGuard, getSessionById);
router.patch('/:id', authMiddleware, roleGuard('admin'), updateSession);
router.delete('/:id', authMiddleware, roleGuard('admin'), deleteSession);
router.patch('/:id/status', authMiddleware, roleGuard('admin'), updateSessionStatus);
router.get('/:id/participants', authMiddleware, roleGuard('admin'), getParticipants);
router.post('/:id/participants', authMiddleware, roleGuard('admin'), addParticipant);
router.delete('/:id/participants/:uid', authMiddleware, roleGuard('admin'), removeParticipant);

router.get('/:id/presence', authMiddleware, (req, res) => {
  const participants = getSessionPresence(req.params.id);
  res.json({ participants });
});

router.post('/:id/live-invite', authMiddleware, roleGuard('admin'), liveInvite);
router.delete('/:id/live-remove/:participantId', authMiddleware, roleGuard('admin'), liveRemove);

router.get('/:id/analytics', authMiddleware, roleGuard('admin'), sessionAccessGuard, getSessionAnalytics);
router.get('/:id/admin-dm', authMiddleware, participantGetChats);
router.post('/:id/admin-dm/reply', authMiddleware, participantSendMessage);

router.use('/:id/comments', authMiddleware, sessionAccessGuard, commentRoutes);

module.exports = router;
