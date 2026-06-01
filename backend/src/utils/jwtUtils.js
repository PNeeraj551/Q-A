const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');

const signToken = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });

const verifyToken = (token) => jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });

module.exports = { signToken, verifyToken };
