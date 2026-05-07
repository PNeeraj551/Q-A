const mongoose = require('mongoose');
const Comment = require('../models/Comment');
const SessionActivity = require('../models/SessionActivity');
const { getPresenceSnapshot } = require('../sockets/socketHandler');
const { success, error } = require('../utils/responseUtils');

function formatTime(date) {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function floorTo5Min(date) {
  const ms = 5 * 60 * 1000;
  return new Date(Math.floor(date.getTime() / ms) * ms);
}

async function getSessionAnalytics(req, res) {
  try {
    const session_id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(session_id)) return error(res, 'Invalid session ID', 400);

    const session = req.session;
    const now = new Date();
    const tenMinutesAgo = new Date(now - 10 * 60 * 1000);
    const fiveMinutesAgo = new Date(now - 5 * 60 * 1000);

    const public_questions_count = await Comment.countDocuments({ session_id, is_deleted: false });

    const presenceEntries = getPresenceSnapshot(session_id);
    const participants_active = presenceEntries.filter(
      p => p.last_activity_time && p.last_activity_time > tenMinutesAgo
    ).length;
    const participants_idle = Math.max(0, presenceEntries.length - participants_active);

    const allEvents = await SessionActivity.find({ session_id }).sort({ timestamp: 1 }).lean();

    const bucketMap = new Map();
    for (const evt of allEvents) {
      const key = floorTo5Min(evt.timestamp).toISOString();
      bucketMap.set(key, (bucketMap.get(key) || 0) + 1);
    }

    let peakKey = null, peakCount = 0;
    for (const [key, count] of bucketMap.entries()) {
      if (count > peakCount) { peakCount = count; peakKey = key; }
    }
    const peak_activity_time = peakKey ? formatTime(new Date(peakKey)) : null;

    const recentCount = allEvents.filter(e => e.timestamp >= fiveMinutesAgo).length;
    const activity_intensity = recentCount <= 5 ? 'LOW' : recentCount <= 20 ? 'MEDIUM' : 'HIGH';

    const sessionStart = session.planned_start_time || session.created_at;
    const startBucket = floorTo5Min(new Date(sessionStart));
    const engagement_timeline = [];
    let cursor = new Date(startBucket);
    while (cursor <= now) {
      engagement_timeline.push({ time: formatTime(cursor), events: bucketMap.get(cursor.toISOString()) || 0 });
      cursor = new Date(cursor.getTime() + 5 * 60 * 1000);
    }

    return success(res, {
      public_questions_count,
      participants_active,
      participants_idle,
      peak_activity_time,
      activity_intensity,
      engagement_timeline,
    });
  } catch (err) {
    console.error('[analytics] error:', err.message);
    return error(res, 'Failed to load analytics', 500);
  }
}

module.exports = { getSessionAnalytics };
