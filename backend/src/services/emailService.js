const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM } = require('../config/env');

logger.info('[email] SMTP config loaded', {
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  user: SMTP_USER,
  from: SMTP_FROM,
});

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
  pool: true,
  maxConnections: 3,
  maxMessages: 100,
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
});

async function verifySmtp() {
  try {
    await transporter.verify();
    logger.info('[email] SMTP connection verified OK');
  } catch (err) {
    logger.error('[email] SMTP verify failed', {
      message: err.message,
      code: err.code,
      command: err.command,
      response: err.response,
    });
  }
}

async function sendOtpEmail(toEmail, otp) {
  try {
    logger.info(`[email] Sending OTP to ${toEmail}`);
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
    logger.info(`[email] OTP sent successfully to ${toEmail}`);
  } catch (err) {
    logger.error(`[email] sendMail failed to ${toEmail}`, {
      message: err.message,
      code: err.code,
      command: err.command,
      response: err.response,
    });
    throw err;
  }
}

module.exports = { sendOtpEmail, verifySmtp };
