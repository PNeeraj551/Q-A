const db = require('../config/supabase');
const { success, error } = require('../utils/responseUtils');
const logger = require('../utils/logger');

// GET /api/qna/analytics
const getAnalytics = async (req, res) => {
  try {
    const { data, error: rpcErr } = await db.rpc('get_analytics');
    if (rpcErr) throw rpcErr;

    return success(res, data);
  } catch (err) {
    logger.error('getAnalytics error', { err: err.message });
    return error(res, 'Failed to load analytics.', 500);
  }
};

module.exports = { getAnalytics };
