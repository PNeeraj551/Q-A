const crypto = require('crypto');
const { COOKIE_NAME, cookieOptions } = require('../config/cookies');
const QnaPost = require('../models/QnaPost');
const Otp = require('../models/Otp');
const UserSession = require('../models/UserSession');
const User = require('../models/User');
const { sendOtpEmail } = require('../services/emailService');
const { success, error } = require('../utils/responseUtils');
const { isBoardClosed } = require('../utils/boardUtils');
const logger = require('../utils/logger');

const ATHIVA_EMAIL = /^[a-zA-Z0-9._%+-]+@athivatech\.com$/i;
const OTP_EXPIRY_MS = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 3;

// GET /api/join/:shareCode
const getBoard = async (req, res) => {
  const { shareCode } = req.params;
  try {
    const post = await QnaPost.findByShareCode(shareCode);
    if (!post) return error(res, 'Board not found', 404);
    if (!post.join_enabled) return error(res, 'Joining is disabled for this board', 403);
    if (isBoardClosed(post)) return error(res, 'This board has ended', 410);

    const existingToken = req.cookies?.[COOKIE_NAME];
    if (!existingToken) {
      res.cookie(COOKIE_NAME, crypto.randomUUID(), cookieOptions);
    }

    return success(res, {
      board: {
        id: post.id,
        title: post.title,
        description: post.description,
        status: post.status,
        end_at: post.end_at,
        join_enabled: post.join_enabled,
      },
    });
  } catch (err) {
    logger.error('[getBoard] ERROR', { message: err.message });
    return error(res, 'Failed to load board', 500);
  }
};

// POST /api/join/:shareCode/otp
const requestJoinOtp = async (req, res) => {
  const { shareCode } = req.params;
  const { email } = req.body;

  if (!email || typeof email !== 'string' || !ATHIVA_EMAIL.test(email.trim())) {
    return error(res, 'A valid @athivatech.com email is required', 400);
  }
  const normalEmail = email.trim().toLowerCase();

  try {
    const post = await QnaPost.findByShareCode(shareCode);
    if (!post) return error(res, 'Board not found', 404);
    if (!post.join_enabled) return error(res, 'Joining is disabled for this board', 403);
    if (isBoardClosed(post)) return error(res, 'This board has ended', 410);

    // Verify user exists in the organisation
    const user = await User.findByEmailRaw(normalEmail);
    if (!user) return error(res, 'No account found for this email.', 404);
    if (!user.is_active) return error(res, 'Your account is inactive. Contact your administrator.', 403);

    await Otp.clearByEmail(normalEmail);

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otp_hash = crypto.createHash('sha256').update(otp).digest('hex');

    await Otp.create({
      email: normalEmail,
      otp_hash,
      expires_at: new Date(Date.now() + OTP_EXPIRY_MS).toISOString(),
    });

    await sendOtpEmail(normalEmail, otp);

    return success(res, { message: 'Verification code sent to your email.' });
  } catch (err) {
    logger.error('[requestJoinOtp] ERROR', { message: err.message });
    return error(res, 'Failed to send verification code. Please try again.', 500);
  }
};

// POST /api/join/:shareCode/verify
const verifyJoinOtp = async (req, res) => {
  const { shareCode } = req.params;
  const { email, otp } = req.body;

  if (!email || typeof email !== 'string' || !ATHIVA_EMAIL.test(email.trim())) {
    return error(res, 'A valid @athivatech.com email is required', 400);
  }
  if (!otp || typeof otp !== 'string' || !/^\d{6}$/.test(otp.trim())) {
    return error(res, 'A 6-digit code is required', 400);
  }
  const normalEmail = email.trim().toLowerCase();

  try {
    const post = await QnaPost.findByShareCode(shareCode);
    if (!post) return error(res, 'Board not found', 404);
    if (!post.join_enabled) return error(res, 'Joining is disabled for this board', 403);
    if (isBoardClosed(post)) return error(res, 'This board has ended', 410);

    // Re-verify user is still active at time of verification
    const user = await User.findByEmailRaw(normalEmail);
    if (!user) return error(res, 'No account found for this email.', 404);
    if (!user.is_active) return error(res, 'Your account is inactive. Contact your administrator.', 403);

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

    const session = await UserSession.upsert({
      qnaId: post.id,
      userId: user.id,
      email: normalEmail,
      displayName: user.name,
      isAnonymous: true,
    });

    logger.info('[verifyJoinOtp] User joined board', { userId: user.id, qnaId: post.id });

    return success(res, {
      session_token: session.session_token,
      user_id: session.user_id,
      email: session.email,
      display_name: session.display_name,
      is_anonymous: session.is_anonymous,
      qna_id: session.qna_id,
    });
  } catch (err) {
    logger.error('[verifyJoinOtp] ERROR', { message: err.message });
    return error(res, 'Verification failed. Please try again.', 500);
  }
};

// PATCH /api/join/:shareCode/anonymous
const toggleAnonymous = async (req, res) => {
  try {
    const updated = await UserSession.updateAnonymous(req.userSession.id, !req.userSession.is_anonymous);
    return success(res, { is_anonymous: updated.is_anonymous });
  } catch (err) {
    logger.error('toggleAnonymous error', { err: err.message });
    return error(res, 'Failed to update anonymous setting.', 500);
  }
};

module.exports = { getBoard, requestJoinOtp, verifyJoinOtp, toggleAnonymous };
