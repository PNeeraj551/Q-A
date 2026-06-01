const crypto = require('crypto');
const User = require('../models/User');
const Otp = require('../models/Otp');
const { signToken } = require('../utils/jwtUtils');
const { success, error } = require('../utils/responseUtils');
const { sendOtpEmail } = require('../services/emailService');
const logger = require('../utils/logger');
const { NODE_ENV } = require('../config/env');

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: NODE_ENV === 'production',
  sameSite: NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 8 * 60 * 60 * 1000,
  path: '/',
};

const ATHIVA_EMAIL = /^[a-zA-Z0-9._%+-]+@athivatech\.com$/i;
const OTP_EXPIRY_MS = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const NAME_MAX = 80;

// POST /auth/request-otp
const requestOtp = async (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string' || !ATHIVA_EMAIL.test(email.trim())) {
    return error(res, 'A valid @athivatech.com email is required', 400);
  }
  const normalEmail = email.trim().toLowerCase();
  try {
    const user = await User.findByEmail(normalEmail);
    if (user && user.role === 'admin') {
      await Otp.clearByEmail(normalEmail);

      const otp = crypto.randomInt(100000, 1000000).toString();
      const otp_hash = crypto.createHash('sha256').update(otp).digest('hex');

      await Otp.create({
        email: normalEmail,
        otp_hash,
        expires_at: new Date(Date.now() + OTP_EXPIRY_MS).toISOString(),
      });

      if (process.env.NODE_ENV === 'development') {
        console.log(`\n[DEV] OTP for ${normalEmail}: ${otp}\n`);
      }

      await sendOtpEmail(normalEmail, otp);
    }

    return success(res, { message: 'If an eligible account exists, a login code has been sent.' });
  } catch (err) {
    logger.error('[requestOtp] ERROR', { message: err.message, code: err.code });
    return error(res, 'Failed to send login code. Please try again.', 500);
  }
};

// POST /auth/verify-otp
const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  if (!email || typeof email !== 'string' || !ATHIVA_EMAIL.test(email.trim())) {
    return error(res, 'A valid @athivatech.com email is required', 400);
  }
  if (!otp || typeof otp !== 'string' || !/^\d{6}$/.test(otp.trim())) {
    return error(res, 'A 6-digit code is required', 400);
  }
  const normalEmail = email.trim().toLowerCase();
  try {
    const user = await User.findByEmail(normalEmail);
    const record = user ? await Otp.findActiveByEmail(normalEmail) : null;

    if (!user || !record) {
      return error(res, 'Invalid email or code.', 401);
    }

    if (record.attempts >= MAX_OTP_ATTEMPTS) {
      await Otp.updateById(record.id, { used: true });
      return error(res, 'Too many incorrect attempts. Please request a new code.', 429);
    }

    const inputHash = crypto.createHash('sha256').update(otp.trim()).digest('hex');
    const inputBuf = Buffer.from(inputHash, 'hex');
    const storedBuf = Buffer.from(record.otp_hash, 'hex');
    const match = inputBuf.length === storedBuf.length && crypto.timingSafeEqual(inputBuf, storedBuf);
    if (!match) {
      await Otp.updateById(record.id, { attempts: record.attempts + 1 });
      return error(res, 'Invalid email or code.', 401);
    }

    await Otp.updateById(record.id, { used: true });

    logger.info('[verifyOtp] Login success', { userId: user.id });

    const token = signToken({
      user_id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      is_active: user.is_active,
      is_root: user.is_root,
      status: user.status || 'VERIFIED',
    });

    res.cookie('token', token, COOKIE_OPTIONS);

    return success(res, {
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    logger.error('[verifyOtp] ERROR', { message: err.message, code: err.code });
    return error(res, 'Verification failed. Please try again.', 500);
  }
};

// GET /auth/me
const me = async (req, res) => {
  try {
    const user = await User.findById(req.user.user_id);
    if (!user) return error(res, 'User not found', 404);

    return success(res, {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      is_active: user.is_active,
      created_at: user.created_at,
    });
  } catch (err) {
    logger.error('me error', { err: err.message });
    return error(res, 'Failed to retrieve user profile.', 500);
  }
};

// POST /auth/logout
const logout = (req, res) => {
  const { maxAge, ...clearOptions } = COOKIE_OPTIONS;
  res.clearCookie('token', clearOptions);
  return success(res, { message: 'Logged out' });
};

// PATCH /auth/me  — name only; email is immutable
const updateMe = async (req, res) => {
  const { name } = req.body;

  try {
    const user = await User.findById(req.user.user_id);
    if (!user) return error(res, 'User not found', 404);

    if (name !== undefined) {
      const trimmed = (name || '').trim();
      if (!trimmed) return error(res, 'Name is required', 400);
      if (trimmed.length > NAME_MAX) return error(res, `Name must be ${NAME_MAX} characters or fewer`, 400);

      const updated = await User.updateById(req.user.user_id, { name: trimmed });
      return success(res, {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        is_active: updated.is_active,
        created_at: updated.created_at,
      });
    }

    return success(res, {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      is_active: user.is_active,
      created_at: user.created_at,
    });
  } catch (err) {
    logger.error('updateMe error', { err: err.message });
    return error(res, 'Failed to update profile.', 500);
  }
};

module.exports = { requestOtp, verifyOtp, me, logout, updateMe };
