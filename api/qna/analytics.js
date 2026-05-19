const supabase = require('../_lib/supabase');
const { withRole } = require('../_lib/roleGuard');
const { sendSuccess, sendError, handleCors } = require('../_lib/response');

async function getAnalytics(req, res) {
  try {
    const { data, error } = await supabase.rpc('get_analytics');
    if (error) throw error;
    return sendSuccess(res, data);
  } catch (err) {
    console.error('[getAnalytics]', err);
    return sendError(res, 'Failed to load analytics.', 500);
  }
}

module.exports = function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') return sendError(res, 'Method not allowed', 405);
  return withRole('admin', getAnalytics)(req, res);
};
