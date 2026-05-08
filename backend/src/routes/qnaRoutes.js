const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const roleGuard = require('../middleware/roleGuard');
const qnaAccessGuard = require('../middleware/qnaAccessGuard');
const {
  listQna,
  getQna,
  createQna,
  updateQna,
  deleteQna,
  getParticipants,
  addParticipant,
  removeParticipant,
} = require('../controllers/qnaController');

const adminOnly = [authMiddleware, roleGuard('admin')];
const authenticated = [authMiddleware];

router.get('/', authenticated, listQna);
router.post('/', adminOnly, createQna);
router.get('/:id', authenticated, qnaAccessGuard, getQna);
router.patch('/:id', adminOnly, updateQna);
router.delete('/:id', adminOnly, deleteQna);
router.get('/:id/participants', adminOnly, getParticipants);
router.post('/:id/participants', adminOnly, addParticipant);
router.delete('/:id/participants/:userId', adminOnly, removeParticipant);

module.exports = router;
