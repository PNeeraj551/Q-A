const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const roleGuard = require('../middlewares/roleGuard');
const { getUsers, createUser, updateUser, deleteUser } = require('../controllers/userController');

const adminOnly = [authMiddleware, roleGuard('admin')];

router.get('/', adminOnly, getUsers);
router.post('/', adminOnly, createUser);
router.patch('/:id', adminOnly, updateUser);
router.delete('/:id', adminOnly, deleteUser);

module.exports = router;
