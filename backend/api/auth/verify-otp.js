const crypto = require('crypto');
const supabase = require('../_lib/supabase');
const { signToken } = require('../_lib/jwt');
const { sendSuccess, sendError, handleCors, formatUser } = require('../_lib/response');

const ATHIVA_EMAIL = /^[a-zA-Z0-9._%+-]+@athivatech\.com$/i;
const MAX_OTP_ATTEMPTS = 5;

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return sendError(res, 'Method not allowed', 405);

  const { email, otp } = req.body || {};
  if (!email || typeof email !== 'string' || !ATHIVA_EMAIL.test(email.trim())) {
    return sendError(res, 'A valid @athivatech.com email is required', 400);
  }
  if (!otp || typeof otp !== 'string' || !/^\d{6}$/.test(otp.trim())) {
    return sendError(res, 'A 6-digit code is required', 400);
  }

  const normalEmail = email.trim().toLowerCase();

  try {
    const { data: record } = await supabase
      .from('otps')
      .select('id, otp_hash, attempts, used, expires_at')
      .eq('email', normalEmail)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!record) {
      return sendError(res, 'Code is invalid or has expired. Please request a new one.', 401);
    }

    if (record.attempts >= MAX_OTP_ATTEMPTS) {
      await supabase.from('otps').delete().eq('id', record.id);
      return sendError(res, 'Too many failed attempts. Please request a new code.', 429);
    }

    const inputHash = crypto.createHash('sha256').update(otp.trim()).digest('hex');
    if (inputHash !== record.otp_hash) {
      const newAttempts = record.attempts + 1;
      await supabase.from('otps').update({ attempts: newAttempts }).eq('id', record.id);
      const remaining = MAX_OTP_ATTEMPTS - newAttempts;
      return sendError(res, `Incorrect code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`, 401);
    }

    await supabase.from('otps').update({ used: true }).eq('id', record.id);

    const { data: user } = await supabase
      .from('users')
      .select('id, name, email, role, is_active, is_root, created_at')
      .eq('email', normalEmail)
      .eq('is_active', true)
      .maybeSingle();

    if (!user) return sendError(res, 'Account not found or inactive.', 401);

    const token = signToken({
      user_id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });

    return sendSuccess(res, { token, user: formatUser(user) });
  } catch (err) {
    console.error('[verify-otp]', err);
    return sendError(res, 'Verification failed. Please try again.', 500);
  }
};
