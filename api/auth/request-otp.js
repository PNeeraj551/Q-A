const crypto = require('crypto');
const supabase = require('../_lib/supabase');
const { sendOtpEmail } = require('../_lib/email');
const { sendSuccess, sendError, handleCors } = require('../_lib/response');

const ATHIVA_EMAIL = /^[a-zA-Z0-9._%+-]+@athivatech\.com$/i;
const OTP_EXPIRY_MS = 10 * 60 * 1000;

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return sendError(res, 'Method not allowed', 405);

  const { email } = req.body || {};
  if (!email || typeof email !== 'string' || !ATHIVA_EMAIL.test(email.trim())) {
    return sendError(res, 'A valid @athivatech.com email is required', 400);
  }
  const normalEmail = email.trim().toLowerCase();

  try {
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalEmail)
      .eq('is_active', true)
      .maybeSingle();

    if (!user) {
      return sendSuccess(res, { message: 'If this email is registered, a login code has been sent.' });
    }

    // Clear old OTPs for this email
    await supabase.rpc('delete_expired_otps', { p_email: normalEmail });
    await supabase.from('otps').delete().eq('email', normalEmail);

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otp_hash = crypto.createHash('sha256').update(otp).digest('hex');

    await supabase.from('otps').insert({
      email: normalEmail,
      otp_hash,
      expires_at: new Date(Date.now() + OTP_EXPIRY_MS).toISOString(),
    });

    await sendOtpEmail(normalEmail, otp);

    return sendSuccess(res, { message: 'Login code sent to your email.' });
  } catch (err) {
    console.error('[request-otp]', err);
    return sendError(res, 'Failed to send login code. Please try again.', 500);
  }
};
