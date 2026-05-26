const { NODE_ENV } = require('./env');

const COOKIE_NAME = 'aq_device_token';
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

const cookieOptions = {
  httpOnly: true,
  secure: NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: ONE_YEAR_SECONDS * 1000,
};

module.exports = { COOKIE_NAME, cookieOptions };
