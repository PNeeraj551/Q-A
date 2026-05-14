const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const roleGuard = require('../middlewares/roleGuard');
const qnaAccessGuard = require('../middlewares/qnaAccessGuard');
const {
  listQna,
  getQna,
  createQna,
  updateQna,
  deleteQna,
  getUsers,
  addUser,
  removeUser,
} = require('../controllers/qnaController');
const { getAnalytics } = require('../controllers/analyticsController');

const adminOnly = [authMiddleware, roleGuard('admin')];
const authenticated = [authMiddleware];

router.get('/', authenticated, listQna);
router.post('/', adminOnly, createQna);
router.get('/:id', authenticated, qnaAccessGuard, getQna);
router.patch('/:id', adminOnly, updateQna);
router.delete('/:id', adminOnly, deleteQna);
router.get('/:id/users', adminOnly, getUsers);
router.post('/:id/users', adminOnly, addUser);
router.delete('/:id/users/:userId', adminOnly, removeUser);
router.get('/analytics', adminOnly, getAnalytics);

module.exports = router;
