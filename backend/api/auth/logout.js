const { withAuth } = require('../_lib/auth');
const { sendSuccess, sendError, handleCors } = require('../_lib/response');

module.exports = function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return sendError(res, 'Method not allowed', 405);
  return withAuth((req, res) => sendSuccess(res, { message: 'Logged out' }))(req, res);
};
