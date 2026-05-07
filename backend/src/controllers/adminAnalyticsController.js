const mongoose = require('mongoose');
const Session = require('../models/Session');
const Comment = require('../models/Comment');
const SessionActivity = require('../models/SessionActivity');
const { success, error } = require('../utils/responseUtils');

const COMPLETED = ['POST_SESSION', 'CLOSED'];

function formatTime(date) {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function floorTo5Min(date) {
  const ms = 5 * 60 * 1000;
  return new Date(Math.floor(date.getTime() / ms) * ms);
}

function buildWeeklyTrend(weeklyAgg) {
  const now = new Date();
  const result = [];
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    const isoYear = getISOWeekYear(d);
    const isoWeek = getISOWeek(d);
    const found = weeklyAgg.find(w => w._id.year === isoYear && w._id.week === isoWeek);
    result.push({ week: `Wk ${isoWeek}`, count: found ? found.count : 0 });
  }
  return result;
}

function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function getISOWeekYear(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  return d.getUTCFullYear();
}

// GET /api/admin/analytics/overview
async function getOverviewAnalytics(req, res) {
  try {
    const totalSessions = await Session.countDocuments();

    const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const sessionsThisWeek = await Session.countDocuments({ planned_date: { $gte: weekStart } });

    const allActiveParticipants = await Comment.distinct('participant_id', {
      is_admin_comment: false,
      is_deleted: false,
    });
    const participantsActive = allActiveParticipants.length;

    const statusAgg = await Session.aggregate([
      { $group: { _id: '$session_status', count: { $sum: 1 } } },
    ]);
    const sessionStatusData = statusAgg.map(s => ({ status: s._id, count: s.count }));

    const topSessionAgg = await Comment.aggregate([
      { $match: { is_deleted: false, is_admin_comment: false } },
      { $group: { _id: '$session_id', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 },
    ]);
    let mostActiveSession = null;
    if (topSessionAgg.length) {
      const s = await Session.findById(topSessionAgg[0]._id).select('session_title').lean();
      if (s) mostActiveSession = { title: s.session_title, count: topSessionAgg[0].count };
    }

    const eightWeeksAgo = new Date(Date.now() - 56 * 24 * 60 * 60 * 1000);
    const weeklyAgg = await SessionActivity.aggregate([
      { $match: { timestamp: { $gte: eightWeeksAgo } } },
      {
        $group: {
          _id: { year: { $isoWeekYear: '$timestamp' }, week: { $isoWeek: '$timestamp' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.week': 1 } },
    ]);
    const engagementTrend = buildWeeklyTrend(weeklyAgg);

    const sessions = await Session.find()
      .select('session_title planned_date session_status')
      .sort({ planned_date: -1 })
      .limit(50)
      .lean();

    const sessionIds = sessions.map(s => s._id);
    const eventCountsAgg = await SessionActivity.aggregate([
      { $match: { session_id: { $in: sessionIds } } },
      { $group: { _id: '$session_id', total: { $sum: 1 } } },
    ]);
    const eventCountMap = new Map(eventCountsAgg.map(e => [e._id.toString(), e.total]));

    const sessionsTable = sessions.map(s => {
      const total = eventCountMap.get(s._id.toString()) || 0;
      const engagement = COMPLETED.includes(s.session_status)
        ? total <= 30 ? 'Low' : total <= 100 ? 'Medium' : 'High'
        : null;
      return { _id: s._id, title: s.session_title, date: s.planned_date, status: s.session_status, engagement };
    });

    const completedWithActivity = sessionsTable.filter(s => COMPLETED.includes(s.status) && s.engagement);
    let avgEngagement = null;
    if (completedWithActivity.length) {
      const score = completedWithActivity.reduce(
        (sum, s) => sum + (s.engagement === 'Low' ? 1 : s.engagement === 'Medium' ? 2 : 3), 0
      ) / completedWithActivity.length;
      avgEngagement = score < 1.5 ? 'Low' : score < 2.5 ? 'Medium' : 'High';
    }

    return success(res, {
      totalSessions,
      sessionsThisWeek,
      participantsActive,
      avgEngagement,
      mostActiveSession,
      engagementTrend,
      sessionStatusData,
      sessionsTable,
    });
  } catch (err) {
    console.error('[admin-analytics] overview error:', err.message);
    return error(res, 'Failed to load analytics overview', 500);
  }
}

// GET /api/admin/analytics/session/:sessionId
async function getSessionDetailAnalytics(req, res) {
  const { sessionId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(sessionId)) {
    return error(res, 'Invalid session ID', 400);
  }

  try {
    const session = await Session.findById(sessionId).lean();
    if (!session) return error(res, 'Session not found', 404);

    if (!COMPLETED.includes(session.session_status)) {
      return res.status(200).json({
        available: false,
        message: 'Analytics available after session completion.',
      });
    }

    const public_questions_count = await Comment.countDocuments({
      session_id: sessionId,
      is_deleted: false,
    });

    const distinctParticipants = await Comment.distinct('participant_id', {
      session_id: sessionId,
      is_admin_comment: false,
      is_deleted: false,
    });
    const participants_active = distinctParticipants.length;

    const allEvents = await SessionActivity.find({ session_id: sessionId })
      .sort({ timestamp: 1 })
      .lean();

    const totalBuckets = new Map();
    const collabBuckets = new Map();
    const questionBuckets = new Map();

    for (const evt of allEvents) {
      const key = floorTo5Min(evt.timestamp).toISOString();
      totalBuckets.set(key, (totalBuckets.get(key) || 0) + 1);
      if (evt.event_type === 'collab_message') {
        collabBuckets.set(key, (collabBuckets.get(key) || 0) + 1);
      }
      if (evt.event_type === 'comment') {
        questionBuckets.set(key, (questionBuckets.get(key) || 0) + 1);
      }
    }

    let peakKey = null, peakCount = 0;
    for (const [key, count] of totalBuckets.entries()) {
      if (count > peakCount) { peakCount = count; peakKey = key; }
    }
    const peak_activity_time = peakKey ? formatTime(new Date(peakKey)) : null;

    const totalEvents = allEvents.length;
    const engagement_level = totalEvents <= 30 ? 'Low' : totalEvents <= 100 ? 'Medium' : 'High';

    const sessionStart = session.planned_start_time || session.created_at;
    const sessionEnd = session.closed_at || new Date();
    const startBucket = floorTo5Min(new Date(sessionStart));
    const timeline = [];
    const question_timeline = [];
    const anonymous_collaboration_activity = [];
    let cursor = new Date(startBucket);

    while (cursor <= new Date(sessionEnd)) {
      const key = cursor.toISOString();
      timeline.push({ time: formatTime(cursor), activity: totalBuckets.get(key) || 0 });
      question_timeline.push({ time: formatTime(cursor), activity: questionBuckets.get(key) || 0 });
      anonymous_collaboration_activity.push({ time: formatTime(cursor), count: collabBuckets.get(key) || 0 });
      cursor = new Date(cursor.getTime() + 5 * 60 * 1000);
    }

    return res.status(200).json({
      available: true,
      participants_active,
      peak_activity_time,
      engagement_level,
      public_questions_count,
      timeline,
      question_timeline,
      anonymous_collaboration_activity,
    });
  } catch (err) {
    console.error('[admin-analytics] session detail error:', err.message);
    return error(res, 'Failed to load session analytics', 500);
  }
}

module.exports = { getOverviewAnalytics, getSessionDetailAnalytics };
