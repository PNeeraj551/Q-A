const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const roleGuard = require('../middleware/roleGuard');
const { getUsers, createUser, updateUser, deleteUser } = require('../controllers/userController');

const adminOnly = [authMiddleware, roleGuard('admin')];

router.get('/', adminOnly, getUsers);
router.post('/', adminOnly, createUser);
router.patch('/:id', adminOnly, updateUser);
router.delete('/:id', adminOnly, deleteUser);

module.exports = router;
