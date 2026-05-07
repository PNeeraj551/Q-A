const mongoose = require('mongoose');
const Comment = require('../models/Comment');
const Session = require('../models/Session');
const SessionActivity = require('../models/SessionActivity');
const { success, error } = require('../utils/responseUtils');

const ALLOWED_STATUSES = ['POST_SESSION', 'CLOSED'];

function formatTime(date) {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function floorTo5Min(date) {
  const ms = 5 * 60 * 1000;
  return new Date(Math.floor(date.getTime() / ms) * ms);
}

// GET /api/admin/session-analytics/:sessionId
async function getPostSessionAnalytics(req, res) {
  const { sessionId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(sessionId)) {
    return error(res, 'Invalid session ID', 400);
  }

  try {
    const session = await Session.findById(sessionId).lean();
    if (!session) return error(res, 'Session not found', 404);

    if (!ALLOWED_STATUSES.includes(session.session_status)) {
      return error(res, 'Analytics only available after session ends', 403);
    }

    // Public question count (non-deleted, non-hidden)
    const public_questions_count = await Comment.countDocuments({
      session_id: sessionId,
      is_deleted: false,
    });

    // Unique participants who engaged (posted at least one comment)
    const distinctParticipants = await Comment.distinct('participant_id', {
      session_id: sessionId,
      is_admin_comment: false,
      is_deleted: false,
    });
    const participants_active = distinctParticipants.length;

    // All anonymous activity events for this session
    const allEvents = await SessionActivity.find({ session_id: sessionId })
      .sort({ timestamp: 1 })
      .lean();

    const collabEvents = allEvents.filter(e => e.event_type === 'collab_message');

    // Bucket all events into 5-min windows
    const totalBuckets = new Map();
    const collabBuckets = new Map();

    for (const evt of allEvents) {
      const key = floorTo5Min(evt.timestamp).toISOString();
      totalBuckets.set(key, (totalBuckets.get(key) || 0) + 1);
    }
    for (const evt of collabEvents) {
      const key = floorTo5Min(evt.timestamp).toISOString();
      collabBuckets.set(key, (collabBuckets.get(key) || 0) + 1);
    }

    // Peak activity time — bucket with most total events
    let peakKey = null, peakCount = 0;
    for (const [key, count] of totalBuckets.entries()) {
      if (count > peakCount) { peakCount = count; peakKey = key; }
    }
    const peak_activity_time = peakKey ? formatTime(new Date(peakKey)) : null;

    // Engagement level based on total event count (session is over; recency doesn't apply)
    const totalEvents = allEvents.length;
    const engagement_level = totalEvents <= 30 ? 'Low' : totalEvents <= 100 ? 'Medium' : 'High';

    // Build timeline from session start to closed_at (or now as fallback)
    const sessionStart = session.planned_start_time || session.created_at;
    const sessionEnd = session.closed_at || new Date();
    const startBucket = floorTo5Min(new Date(sessionStart));
    const timeline = [];
    const anonymous_collaboration_activity = [];
    let cursor = new Date(startBucket);

    while (cursor <= new Date(sessionEnd)) {
      const key = cursor.toISOString();
      timeline.push({ time: formatTime(cursor), activity: totalBuckets.get(key) || 0 });
      anonymous_collaboration_activity.push({ time: formatTime(cursor), count: collabBuckets.get(key) || 0 });
      cursor = new Date(cursor.getTime() + 5 * 60 * 1000);
    }

    return success(res, {
      participants_active,
      peak_activity_time,
      engagement_level,
      public_questions_count,
      timeline,
      anonymous_collaboration_activity,
    });
  } catch (err) {
    console.error('[post-session-analytics] error:', err.message);
    return error(res, 'Failed to load session analytics', 500);
  }
}

module.exports = { getPostSessionAnalytics };
