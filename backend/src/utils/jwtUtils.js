const jwt = require('jsonwebtoken');
const { JWT_SECRET, REFRESH_TOKEN_SECRET } = require('../config/env');

const signAccessToken = (payload) =>
  jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });

const signRefreshToken = (payload) =>
  jwt.sign({ user_id: payload.user_id }, REFRESH_TOKEN_SECRET, { expiresIn: '7d' });

const verifyToken = (token) => jwt.verify(token, JWT_SECRET);

const verifyRefreshToken = (token) => jwt.verify(token, REFRESH_TOKEN_SECRET);

// Alias so existing call sites (socketHandler, etc.) keep working unchanged
const signToken = signAccessToken;

module.exports = { signToken, signAccessToken, signRefreshToken, verifyToken, verifyRefreshToken };
