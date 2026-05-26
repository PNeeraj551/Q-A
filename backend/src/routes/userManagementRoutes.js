const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const roleGuard = require('../middlewares/roleGuard');
const {
  listUsers,
  createUser,
  updateUser,
  unlockUser,
  deleteUser,
} = require('../controllers/userManagementController');

router.get('/', authMiddleware, roleGuard('admin'), listUsers);
router.post('/', authMiddleware, roleGuard('admin'), createUser);
router.patch('/:id', authMiddleware, roleGuard('admin'), updateUser);
router.post('/:id/unlock', authMiddleware, roleGuard('admin'), unlockUser);
router.delete('/:id', authMiddleware, roleGuard('admin'), deleteUser);

module.exports = router;
