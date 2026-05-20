const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM } = require('../config/env');

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
  pool: true,
  maxConnections: 3,
  maxMessages: 100,
  connectionTimeout: 5000,
  greetingTimeout: 5000,
  socketTimeout: 5000,
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
    });
  }
}

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
  } catch (err) {
    logger.error('[email] sendMail failed', {
      message: err.message,
      code: err.code,
      command: err.command,
    });
    throw err;
  }
}

module.exports = { sendOtpEmail, verifySmtp };
