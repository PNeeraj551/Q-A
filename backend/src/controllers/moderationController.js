const db = require('../config/supabase');
const { success, error } = require('../utils/responseUtils');
const logger = require('../utils/logger');
const {
  getSuspiciousIps,
  getVelocityAnomalies,
  getSharedAgentAnomalies,
  getVoteSummary,
  voidVotesByToken,
  voidVoteById,
} = require('../services/voteIntegrityService');

const getSummary = async (req, res) => {
  try {
    const summary = await getVoteSummary();
    return success(res, summary);
  } catch (err) {
    logger.error('moderation getSummary error: ' + err.message);
    return error(res, 'Failed to load summary.', 500);
  }
};

const getSuspicious = async (req, res) => {
  try {
    const [suspiciousIps, velocityAnomalies, sharedAgents] = await Promise.all([
      getSuspiciousIps(),
      getVelocityAnomalies(),
      getSharedAgentAnomalies(),
    ]);
    return success(res, { suspiciousIps, velocityAnomalies, sharedAgents });
  } catch (err) {
    logger.error('moderation getSuspicious error: ' + err.message);
    return error(res, 'Failed to load suspicious activity.', 500);
  }
};

const getVotes = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const offset = parseInt(req.query.offset || '0', 10);

    // Count separately with HEAD request — safe on empty tables, avoids 416
    const { count, error: countErr } = await db
      .from('anonymous_votes')
      .select('*', { count: 'exact', head: true });

    if (countErr) throw countErr;

    const total = count || 0;
    let rows = [];

    if (total > 0) {
      const { data, error: dataErr } = await db
        .from('anonymous_votes')
        .select('id, created_at, device_token, ip_hash')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (dataErr) throw dataErr;

      rows = (data || []).map((r) => ({
        ...r,
        device_token: r.device_token ? r.device_token.slice(0, 8) + '…' : null,
        ip_hash: r.ip_hash ? r.ip_hash.slice(0, 8) + '…' : null,
      }));
    }

    return success(res, { votes: rows, total });
  } catch (err) {
    logger.error('moderation getVotes error: ' + err.message);
    return error(res, 'Failed to load votes.', 500);
  }
};

const voidVotes = async (req, res) => {
  const { token } = req.params;
  try {
    const result = await voidVotesByToken(token);
    logger.info('votes voided by admin', { token: token.slice(0, 8) + '…', deleted: result.deleted });
    return success(res, result);
  } catch (err) {
    logger.error('moderation voidVotes error: ' + err.message);
    return error(res, 'Failed to void votes.', 500);
  }
};

const voidVote = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await voidVoteById(id);
    logger.info('vote voided by admin', { id, deleted: result.deleted });
    return success(res, result);
  } catch (err) {
    logger.error('moderation voidVote error: ' + err.message);
    return error(res, 'Failed to void vote.', 500);
  }
};

module.exports = { getSummary, getSuspicious, getVotes, voidVotes, voidVote };
