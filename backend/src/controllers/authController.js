const crypto = require('crypto');
const User = require('../models/User');
const Otp = require('../models/Otp');
const { signToken } = require('../utils/jwtUtils');
const { success, error } = require('../utils/responseUtils');
const { sendOtpEmail } = require('../services/emailService');
const logger = require('../utils/logger');

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
  const t0 = Date.now();
  try {
    const user = await User.findByEmail(normalEmail);
    logger.info(`[requestOtp] userLookup=${Date.now() - t0}ms`);
    if (!user) {
      return success(res, { message: 'If this email is registered, a login code has been sent.' });
    }

    await Otp.clearByEmail(normalEmail);
    logger.info(`[requestOtp] clearOtp=${Date.now() - t0}ms`);

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otp_hash = crypto.createHash('sha256').update(otp).digest('hex');

    await Otp.create({
      email: normalEmail,
      otp_hash,
      expires_at: new Date(Date.now() + OTP_EXPIRY_MS).toISOString(),
    });
    logger.info(`[requestOtp] createOtp=${Date.now() - t0}ms`);

    const t1 = Date.now();
    await sendOtpEmail(normalEmail, otp);
    logger.info(`[requestOtp] emailSent=${Date.now() - t1}ms total=${Date.now() - t0}ms`);

    return success(res, { message: 'Login code sent to your email.' });
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
    const record = await Otp.findActiveByEmail(normalEmail);

    if (!record) {
      return error(res, 'Code is invalid or has expired. Please request a new one.', 401);
    }

    if (record.attempts >= MAX_OTP_ATTEMPTS) {
      await Otp.deleteById(record.id);
      return error(res, 'Too many failed attempts. Please request a new code.', 429);
    }

    const inputHash = crypto.createHash('sha256').update(otp.trim()).digest('hex');
    if (inputHash !== record.otp_hash) {
      await Otp.updateById(record.id, { attempts: record.attempts + 1 });
      const remaining = MAX_OTP_ATTEMPTS - (record.attempts + 1);
      return error(res, `Incorrect code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`, 401);
    }

    await Otp.updateById(record.id, { used: true });

    const user = await User.findByEmail(normalEmail);
    if (!user) return error(res, 'Account not found or inactive.', 401);

    logger.info('[verifyOtp] Login success', { userId: user.id });

    const token = signToken({
      user_id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      is_active: user.is_active,
      is_root: user.is_root,
    });

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
    return error(res, 'Failed to retrieve user profile.', 500);
  }
};

// POST /auth/logout
const logout = (req, res) => success(res, { message: 'Logged out' });

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
    return error(res, 'Failed to update profile.', 500);
  }
};

module.exports = { requestOtp, verifyOtp, me, logout, updateMe };
