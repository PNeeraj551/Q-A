const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM } = require('../config/env');

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

async function sendOtpEmail(toEmail, otp) {
  try {
    await transporter.sendMail({
      from: SMTP_FROM,
      to: toEmail,
      subject: 'Your login code – Q&A Platform',
      text: [
        'Your one-time login code is:',
        '',
        `  ${otp}`,
        '',
        'This code expires in 10 minutes and can only be used once.',
        'If you did not request this, you can ignore this email.',
        '',
        '– AthivaTech Q&A Platform',
      ].join('\n'),
    });
    logger.info(`[email] OTP sent to ${toEmail}`);
  } catch (err) {
    logger.error(`[email] Failed to send OTP to ${toEmail}: ${err.message}`);
    throw err;
  }
}

module.exports = { sendOtpEmail };
