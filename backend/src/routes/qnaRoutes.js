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
  getUsers,
  addUser,
  removeUser,
} = require('../controllers/qnaController');

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

module.exports = router;
