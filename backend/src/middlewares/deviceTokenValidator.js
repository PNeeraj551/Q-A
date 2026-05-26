const { COOKIE_NAME } = require('../config/cookies');

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STALE_MS = 5 * 60 * 1000;

module.exports = function deviceTokenValidator(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return next();

  if (!UUID_V4.test(token)) {
    return res.status(400).json({ success: false, error: 'Invalid device token' });
  }

  const tsHeader = req.headers['x-request-timestamp'];
  if (tsHeader) {
    const ts = Number(tsHeader);
    if (!ts || Math.abs(Date.now() - ts) > STALE_MS) {
      return res.status(400).json({ success: false, error: 'Request timestamp is stale' });
    }
  }

  next();
};
