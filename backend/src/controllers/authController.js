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
  try {
    logger.info(`[requestOtp] Looking up user: ${normalEmail}`);
    const user = await User.findOne({ email: normalEmail, is_active: true });
    if (!user) {
      logger.info(`[requestOtp] User not found: ${normalEmail}`);
      return success(res, { message: 'If this email is registered, a login code has been sent.' });
    }
    logger.info(`[requestOtp] User found: ${user._id}`);

    await Otp.deleteMany({ email: normalEmail });
    logger.info(`[requestOtp] Old OTPs cleared for: ${normalEmail}`);

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otp_hash = crypto.createHash('sha256').update(otp).digest('hex');

    await Otp.create({
      email: normalEmail,
      otp_hash,
      expires_at: new Date(Date.now() + OTP_EXPIRY_MS),
    });
    logger.info(`[requestOtp] OTP record created for: ${normalEmail}`);

    logger.info(`[requestOtp] Sending email to: ${normalEmail}`);
    await sendOtpEmail(normalEmail, otp);

    return success(res, { message: 'Login code sent to your email.' });
  } catch (err) {
    logger.error('[requestOtp] ERROR:', err);
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
    const record = await Otp.findOne({
      email: normalEmail,
      used: false,
      expires_at: { $gt: new Date() },
    });

    if (!record) {
      return error(res, 'Code is invalid or has expired. Please request a new one.', 401);
    }

    if (record.attempts >= MAX_OTP_ATTEMPTS) {
      await Otp.deleteOne({ _id: record._id });
      return error(res, 'Too many failed attempts. Please request a new code.', 429);
    }

    const inputHash = crypto.createHash('sha256').update(otp.trim()).digest('hex');
    if (inputHash !== record.otp_hash) {
      record.attempts += 1;
      await record.save();
      const remaining = MAX_OTP_ATTEMPTS - record.attempts;
      return error(res, `Incorrect code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`, 401);
    }

    record.used = true;
    await record.save();

    const user = await User.findOne({ email: normalEmail, is_active: true });
    if (!user) return error(res, 'Account not found or inactive.', 401);

    logger.info(`[verifyOtp] Login success: ${normalEmail}`);

    const token = signToken({
      user_id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    });

    return success(res, {
      token,
      user: { _id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    logger.error('[verifyOtp] ERROR:', err);
    return error(res, 'Verification failed. Please try again.', 500);
  }
};

// GET /auth/me
const me = async (req, res) => {
  try {
    const user = await User.findById(req.user.user_id)
      .select('_id name email role is_active created_at');

    if (!user) return error(res, 'User not found', 404);

    return success(res, {
      _id: user._id,
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
      user.name = trimmed;
    }

    await user.save();

    return success(res, {
      _id: user._id,
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
