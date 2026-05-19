const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
});

async function sendOtpEmail(toEmail, otp) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
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
}

module.exports = { sendOtpEmail };
