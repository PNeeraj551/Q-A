const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const roleGuard = require('../middleware/roleGuard');
const { searchArchive, getArchivedSession, getArchivedComments } = require('../controllers/archiveController');

router.get('/sessions', authMiddleware, roleGuard('admin'), searchArchive);
router.get('/sessions/:id', authMiddleware, roleGuard('admin'), getArchivedSession);
router.get('/sessions/:id/comments', authMiddleware, roleGuard('admin'), getArchivedComments);

module.exports = router;
