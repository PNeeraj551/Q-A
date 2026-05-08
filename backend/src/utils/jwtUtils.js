const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');

const signToken = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });

const verifyToken = (token) => jwt.verify(token, JWT_SECRET);

module.exports = { signToken, verifyToken };
