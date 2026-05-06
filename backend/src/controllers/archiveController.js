const mongoose = require('mongoose');
const Session = require('../models/Session');
const Comment = require('../models/Comment');
const { success, error } = require('../utils/responseUtils');

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const VALID_ACCESS_TYPES = ['PUBLIC', 'PRIVATE', 'All'];

const parsePositiveInt = (val, defaultVal, max) => {
  const parsed = parseInt(val, 10);
  if (isNaN(parsed) || parsed < 1) return defaultVal;
  if (max && parsed > max) return max;
  return parsed;
};

const searchArchive = async (req, res) => {
  try {
    const { title, from, to, access_type, participant } = req.query;

    const page = parsePositiveInt(req.query.page, 1, null);
    const limit = parsePositiveInt(req.query.limit, 20, 50);

    if (from) {
      const fromDate = new Date(from);
      if (isNaN(fromDate.getTime())) {
        return error(res, 'Invalid "from" date', 400);
      }
    }
    if (to) {
      const toDate = new Date(to);
      if (isNaN(toDate.getTime())) {
        return error(res, 'Invalid "to" date', 400);
      }
    }
    if (access_type && !VALID_ACCESS_TYPES.includes(access_type)) {
      return error(res, 'access_type must be PUBLIC, PRIVATE, or All', 400);
    }

    let sessions;
    let total;

    if (participant) {
      const escaped = participant.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      const baseMatch = { session_status: 'CLOSED' };

      if (title) baseMatch.$text = { $search: title };

      if (from || to) {
        baseMatch.planned_date = {};
        if (from) baseMatch.planned_date.$gte = new Date(from);
        if (to) baseMatch.planned_date.$lte = new Date(to);
      }

      if (access_type && access_type !== 'All') {
        baseMatch.access_type = access_type;
      }

      const participantMatch = {
        'participants_detail.name': { $regex: escaped, $options: 'i' },
      };

      const pipeline = [
        { $match: baseMatch },
        {
          $lookup: {
            from: 'users',
            localField: 'assigned_participants',
            foreignField: '_id',
            as: 'participants_detail',
          },
        },
        { $match: participantMatch },
        { $project: { participants_detail: 0 } },
      ];

      const countResult = await Session.aggregate([
        ...pipeline,
        { $count: 'total' },
      ]);
      total = countResult.length > 0 ? countResult[0].total : 0;

      sessions = await Session.aggregate([
        ...pipeline,
        { $sort: { planned_date: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
      ]);
    } else {
      const filter = { session_status: 'CLOSED' };

      if (title) filter.$text = { $search: title };

      if (from || to) {
        filter.planned_date = {};
        if (from) filter.planned_date.$gte = new Date(from);
        if (to) filter.planned_date.$lte = new Date(to);
      }

      if (access_type && access_type !== 'All') {
        filter.access_type = access_type;
      }

      total = await Session.countDocuments(filter);
      sessions = await Session.find(filter)
        .sort({ planned_date: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();
    }

    const enriched = await Promise.all(
      sessions.map(async (s) => ({
        ...s,
        participant_count: s.assigned_participants ? s.assigned_participants.length : 0,
        comment_count: await Comment.countDocuments({ session_id: s._id, is_deleted: false }),
      }))
    );

    return success(res, {
      sessions: enriched,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    return error(res, 'Internal server error', 500);
  }
};

const getArchivedSession = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return error(res, 'Invalid session id', 400);
    }

    const session = await Session.findById(id)
      .populate('assigned_participants', '_id name email')
      .lean();

    if (!session || session.session_status !== 'CLOSED') {
      return error(res, 'Session not found in archive', 404);
    }

    return success(res, { session });
  } catch (err) {
    return error(res, 'Internal server error', 500);
  }
};

const getArchivedComments = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return error(res, 'Invalid session id', 400);
    }

    const page = parsePositiveInt(req.query.page, 1, null);
    const limit = parsePositiveInt(req.query.limit, 50, 100);

    const session = await Session.findById(id).select('session_status').lean();
    if (!session || session.session_status !== 'CLOSED') {
      return error(res, 'Session not found in archive', 404);
    }

    const filter = { session_id: new mongoose.Types.ObjectId(id), is_deleted: false };
    const skip = (page - 1) * limit;

    const total = await Comment.countDocuments(filter);
    const comments = await Comment.find(filter)
      .populate('liked_by', 'name')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return success(res, {
      comments,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    return error(res, 'Internal server error', 500);
  }
};

module.exports = { searchArchive, getArchivedSession, getArchivedComments };
