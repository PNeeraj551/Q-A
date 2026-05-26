const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const roleGuard = require('../middlewares/roleGuard');
const { getSummary, getSuspicious, getVotes, voidVotes, voidVote } = require('../controllers/moderationController');

const adminOnly = [authMiddleware, roleGuard('admin')];

router.get('/summary', ...adminOnly, getSummary);
router.get('/suspicious', ...adminOnly, getSuspicious);
router.get('/votes', ...adminOnly, getVotes);
router.delete('/votes/token/:token', ...adminOnly, voidVotes);
router.delete('/votes/:id', ...adminOnly, voidVote);

module.exports = router;
