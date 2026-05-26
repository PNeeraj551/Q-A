const db = require('../config/supabase');
const logger = require('../utils/logger');

async function toggleDeviceVote(qId, boardId, deviceToken, ipHash, userAgent) {
  const { data: existing } = await db
    .from('anonymous_votes')
    .select('id')
    .eq('question_id', qId)
    .eq('device_token', deviceToken)
    .maybeSingle();

  let liked_by_me;
  if (existing) {
    const { error: delError } = await db.from('anonymous_votes').delete().eq('id', existing.id);
    if (delError) throw delError;
    liked_by_me = false;
  } else {
    const { error: insertError } = await db.from('anonymous_votes').insert({
      question_id: qId,
      device_token: deviceToken,
      ip_hash: ipHash,
      user_agent: (userAgent || '').slice(0, 200),
    });
    if (insertError) {
      logger.error('anonymous_votes insert failed', { err: insertError.message, qId });
      throw insertError;
    }
    liked_by_me = true;
  }

  const { count: sessionLikes } = await db
    .from('question_likes')
    .select('*', { count: 'exact', head: true })
    .eq('question_id', qId);
  const { count: anonLikes } = await db
    .from('anonymous_votes')
    .select('*', { count: 'exact', head: true })
    .eq('question_id', qId);
  const likes_count = (sessionLikes || 0) + (anonLikes || 0);
  await db.from('questions').update({ likes_count }).eq('id', qId);

  return { liked_by_me, likes_count };
}

async function getSuspiciousIps(threshold = 5) {
  const { data } = await db
    .from('anonymous_votes')
    .select('ip_hash, device_token')
    .not('ip_hash', 'is', null);

  if (!data) return [];
  const map = {};
  for (const row of data) {
    if (!map[row.ip_hash]) map[row.ip_hash] = new Set();
    map[row.ip_hash].add(row.device_token);
  }
  return Object.entries(map)
    .filter(([, tokens]) => tokens.size > threshold)
    .map(([ip_hash, tokens]) => ({ ip_hash, token_count: tokens.size }))
    .sort((a, b) => b.token_count - a.token_count);
}

async function getVelocityAnomalies(votesPerHour = 15) {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data } = await db
    .from('anonymous_votes')
    .select('device_token, created_at')
    .gte('created_at', since);

  if (!data) return [];
  const map = {};
  for (const row of data) {
    map[row.device_token] = (map[row.device_token] || 0) + 1;
  }
  return Object.entries(map)
    .filter(([, count]) => count > votesPerHour)
    .map(([device_token, votes_last_hour]) => ({ device_token: device_token.slice(0, 8) + '…', votes_last_hour }))
    .sort((a, b) => b.votes_last_hour - a.votes_last_hour);
}

async function getSharedAgentAnomalies(threshold = 10) {
  const { data } = await db
    .from('anonymous_votes')
    .select('user_agent, device_token')
    .not('user_agent', 'is', null);

  if (!data) return [];
  const map = {};
  for (const row of data) {
    if (!row.user_agent) continue;
    if (!map[row.user_agent]) map[row.user_agent] = new Set();
    map[row.user_agent].add(row.device_token);
  }
  return Object.entries(map)
    .filter(([, tokens]) => tokens.size > threshold)
    .map(([user_agent, tokens]) => ({ user_agent: user_agent.slice(0, 80), token_count: tokens.size }))
    .sort((a, b) => b.token_count - a.token_count);
}

async function getVoteSummary() {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [{ count: totalVotes }, { count: last24hVotes }, { data: tokenData }, { data: ipData }] = await Promise.all([
    db.from('anonymous_votes').select('*', { count: 'exact', head: true }),
    db.from('anonymous_votes').select('*', { count: 'exact', head: true }).gte('created_at', since24h),
    db.from('anonymous_votes').select('device_token'),
    db.from('anonymous_votes').select('ip_hash').not('ip_hash', 'is', null),
  ]);

  const uniqueTokens = new Set((tokenData || []).map((r) => r.device_token)).size;
  const uniqueIpHashes = new Set((ipData || []).map((r) => r.ip_hash)).size;

  return { totalVotes: totalVotes || 0, uniqueTokens, uniqueIpHashes, last24hVotes: last24hVotes || 0 };
}

async function voidVotesByToken(deviceToken) {
  const { data, error } = await db
    .from('anonymous_votes')
    .delete()
    .eq('device_token', deviceToken)
    .select('id');
  if (error) throw error;
  return { deleted: (data || []).length };
}

async function voidVoteById(id) {
  const { data, error } = await db
    .from('anonymous_votes')
    .delete()
    .eq('id', id)
    .select('id');
  if (error) throw error;
  return { deleted: (data || []).length };
}

module.exports = { toggleDeviceVote, getSuspiciousIps, getVelocityAnomalies, getSharedAgentAnomalies, getVoteSummary, voidVotesByToken, voidVoteById };
