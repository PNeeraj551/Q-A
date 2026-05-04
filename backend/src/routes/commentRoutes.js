const express = require('express');
const router = express.Router({ mergeParams: true });
const { getComments, createComment } = require('../controllers/commentController');

router.get('/', getComments);
router.post('/', createComment);

module.exports = router;
