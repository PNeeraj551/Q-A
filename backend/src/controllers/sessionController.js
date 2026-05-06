const mongoose = require('mongoose');
const Session = require('../models/Session');
const User = require('../models/User');
const { success, error } = require('../utils/responseUtils');

const VALID_TRANSITIONS = {
  SCHEDULED: ['PRE_SESSION', 'ACTIVE_SESSION'],
  PRE_SESSION: ['ACTIVE_SESSION', 'CLOSED'],
  ACTIVE_SESSION: ['POST_SESSION', 'CLOSED'],
  POST_SESSION: ['CLOSED'],
  CLOSED: [],
};

const BLOCKED_TIME_EDIT_STATUSES = ['ACTIVE_SESSION', 'POST_SESSION', 'CLOSED'];

// GET /api/sessions
const getSessions = async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';

    if (isAdmin) {
      const filter = {};
      if (req.query.status) {
        const allowedStatuses = ['SCHEDULED', 'PRE_SESSION', 'ACTIVE_SESSION', 'POST_SESSION', 'CLOSED'];
        if (!allowedStatuses.includes(req.query.status)) {
          return error(res, 'Invalid status filter value', 400);
        }
        filter.session_status = req.query.status;
      }

      const sessions = await Session.find(filter).lean();
      return success(res, { sessions });
    }

    const participantId = req.user.user_id;

    const sessions = await Session.find({
      $or: [
        { access_type: 'PUBLIC', session_status: { $ne: 'CLOSED' } },
        {
          access_type: 'PRIVATE',
          assigned_participants: participantId,
          session_status: { $ne: 'CLOSED' },
        },
      ],
    })
      .select('-assigned_participants')
      .lean();

    return success(res, { sessions });
  } catch (err) {
    return error(res, 'Failed to fetch sessions', 500);
  }
};

// POST /api/sessions
const createSession = async (req, res) => {
  try {
    const {
      session_title,
      session_description,
      planned_date,
      planned_start_time,
      planned_end_time,
      access_type,
      pre_session_enabled,
      pre_session_minutes,
      assigned_participants,
    } = req.body;

    // Validate session_title
    if (!session_title || typeof session_title !== 'string' || session_title.trim().length === 0) {
      return error(res, 'session_title is required', 400);
    }
    if (session_title.trim().length > 120) {
      return error(res, 'session_title cannot exceed 120 characters', 400);
    }

    // Validate session_description
    if (session_description !== undefined && session_description !== null) {
      if (typeof session_description !== 'string') {
        return error(res, 'session_description must be a string', 400);
      }
      if (session_description.length > 500) {
        return error(res, 'session_description cannot exceed 500 characters', 400);
      }
    }

    // Validate planned_date
    if (!planned_date) {
      return error(res, 'planned_date is required', 400);
    }
    const parsedDate = new Date(planned_date);
    if (isNaN(parsedDate.getTime())) {
      return error(res, 'planned_date must be a valid date', 400);
    }

    // Validate planned_start_time
    if (!planned_start_time) {
      return error(res, 'planned_start_time is required', 400);
    }
    const parsedStart = new Date(planned_start_time);
    if (isNaN(parsedStart.getTime())) {
      return error(res, 'planned_start_time must be a valid datetime', 400);
    }

    // Validate planned_end_time
    if (!planned_end_time) {
      return error(res, 'planned_end_time is required', 400);
    }
    const parsedEnd = new Date(planned_end_time);
    if (isNaN(parsedEnd.getTime())) {
      return error(res, 'planned_end_time must be a valid datetime', 400);
    }
    if (parsedEnd <= parsedStart) {
      return error(res, 'planned_end_time must be strictly after planned_start_time', 400);
    }

    // Validate access_type
    if (!access_type || !['PUBLIC', 'PRIVATE'].includes(access_type)) {
      return error(res, 'access_type is required and must be PUBLIC or PRIVATE', 400);
    }

    // Validate pre_session_enabled
    const preSessionEnabled = pre_session_enabled === true || pre_session_enabled === 'true';
    let preSessionMinutes = 0;

    if (preSessionEnabled) {
      if (pre_session_minutes === undefined || pre_session_minutes === null) {
        return error(res, 'pre_session_minutes is required when pre_session_enabled is true', 400);
      }
      const mins = Number(pre_session_minutes);
      if (!Number.isInteger(mins) || mins < 5 || mins > 120) {
        return error(res, 'pre_session_minutes must be an integer between 5 and 120', 400);
      }
      preSessionMinutes = mins;
    }

    // Validate assigned_participants for PRIVATE sessions
    let participantIds = [];
    if (access_type === 'PRIVATE') {
      if (!Array.isArray(assigned_participants)) {
        return error(res, 'assigned_participants must be an array for PRIVATE sessions', 400);
      }
      for (const uid of assigned_participants) {
        if (!mongoose.Types.ObjectId.isValid(uid)) {
          return error(res, `Invalid participant ID: ${uid}`, 400);
        }
      }
      participantIds = assigned_participants;
    }

    const session = await Session.create({
      session_title: session_title.trim(),
      session_description: session_description ? session_description.trim() : undefined,
      planned_date: parsedDate,
      planned_start_time: parsedStart,
      planned_end_time: parsedEnd,
      access_type,
      session_status: 'SCHEDULED',
      pre_session_enabled: preSessionEnabled,
      pre_session_minutes: preSessionMinutes,
      assigned_participants: participantIds,
      created_by: req.user.user_id,
    });

    return success(res, session.toObject(), 201);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const message = Object.values(err.errors).map((e) => e.message).join(', ');
      return error(res, message, 400);
    }
    return error(res, 'Failed to create session', 500);
  }
};

// GET /api/sessions/:id
const getSessionById = async (req, res) => {
  try {
    return success(res, { session: req.session.toObject() });
  } catch (err) {
    return error(res, 'Failed to fetch session', 500);
  }
};

// PATCH /api/sessions/:id
const updateSession = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return error(res, 'Invalid session ID format', 400);
    }

    const session = await Session.findById(id);
    if (!session) {
      return error(res, 'Session not found', 404);
    }

    const {
      session_title,
      session_description,
      planned_date,
      planned_start_time,
      planned_end_time,
      access_type,
      pre_session_enabled,
      pre_session_minutes,
      assigned_participants,
    } = req.body;

    const updates = {};

    if (session_title !== undefined) {
      if (typeof session_title !== 'string' || session_title.trim().length === 0) {
        return error(res, 'session_title must be a non-empty string', 400);
      }
      if (session_title.trim().length > 120) {
        return error(res, 'session_title cannot exceed 120 characters', 400);
      }
      updates.session_title = session_title.trim();
    }

    if (session_description !== undefined) {
      if (session_description !== null && typeof session_description !== 'string') {
        return error(res, 'session_description must be a string', 400);
      }
      if (session_description && session_description.length > 500) {
        return error(res, 'session_description cannot exceed 500 characters', 400);
      }
      updates.session_description = session_description ? session_description.trim() : undefined;
    }

    // Block time edits if session is in an advanced state
    if (
      (planned_date !== undefined || planned_start_time !== undefined || planned_end_time !== undefined) &&
      BLOCKED_TIME_EDIT_STATUSES.includes(session.session_status)
    ) {
      return error(
        res,
        `Cannot edit planned times when session is in ${session.session_status} status`,
        400
      );
    }

    const newStart = planned_start_time !== undefined ? new Date(planned_start_time) : session.planned_start_time;
    const newEnd = planned_end_time !== undefined ? new Date(planned_end_time) : session.planned_end_time;

    if (planned_date !== undefined) {
      const parsedDate = new Date(planned_date);
      if (isNaN(parsedDate.getTime())) {
        return error(res, 'planned_date must be a valid date', 400);
      }
      updates.planned_date = parsedDate;
    }

    if (planned_start_time !== undefined) {
      if (isNaN(newStart.getTime())) {
        return error(res, 'planned_start_time must be a valid datetime', 400);
      }
      updates.planned_start_time = newStart;
    }

    if (planned_end_time !== undefined) {
      if (isNaN(newEnd.getTime())) {
        return error(res, 'planned_end_time must be a valid datetime', 400);
      }
      updates.planned_end_time = newEnd;
    }

    if (planned_start_time !== undefined || planned_end_time !== undefined) {
      if (newEnd <= newStart) {
        return error(res, 'planned_end_time must be strictly after planned_start_time', 400);
      }
    }

    if (access_type !== undefined) {
      if (!['PUBLIC', 'PRIVATE'].includes(access_type)) {
        return error(res, 'access_type must be PUBLIC or PRIVATE', 400);
      }
      updates.access_type = access_type;
    }

    const resolvedAccessType = updates.access_type || session.access_type;
    const resolvedPreSessionEnabled =
      pre_session_enabled !== undefined
        ? pre_session_enabled === true || pre_session_enabled === 'true'
        : session.pre_session_enabled;

    if (pre_session_enabled !== undefined) {
      updates.pre_session_enabled = resolvedPreSessionEnabled;
    }

    if (resolvedPreSessionEnabled) {
      const minsSource = pre_session_minutes !== undefined ? pre_session_minutes : session.pre_session_minutes;
      const mins = Number(minsSource);
      if (!Number.isInteger(mins) || mins < 5 || mins > 120) {
        return error(res, 'pre_session_minutes must be an integer between 5 and 120', 400);
      }
      updates.pre_session_minutes = mins;
    } else if (pre_session_enabled !== undefined && !resolvedPreSessionEnabled) {
      updates.pre_session_minutes = 0;
    }

    if (assigned_participants !== undefined) {
      if (resolvedAccessType === 'PRIVATE') {
        if (!Array.isArray(assigned_participants)) {
          return error(res, 'assigned_participants must be an array', 400);
        }
        for (const uid of assigned_participants) {
          if (!mongoose.Types.ObjectId.isValid(uid)) {
            return error(res, `Invalid participant ID: ${uid}`, 400);
          }
        }
        updates.assigned_participants = assigned_participants;
      } else {
        updates.assigned_participants = [];
      }
    }

    updates.updated_at = new Date();

    const updatedSession = await Session.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    return success(res, { session: updatedSession.toObject() });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const message = Object.values(err.errors).map((e) => e.message).join(', ');
      return error(res, message, 400);
    }
    if (err.name === 'CastError') {
      return error(res, 'Invalid ID format', 400);
    }
    return error(res, 'Failed to update session', 500);
  }
};

// DELETE /api/sessions/:id
const deleteSession = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return error(res, 'Invalid session ID format', 400);
    }

    const session = await Session.findById(id);
    if (!session) {
      return error(res, 'Session not found', 404);
    }

    if (session.session_status !== 'SCHEDULED') {
      return error(res, 'Only SCHEDULED sessions can be deleted', 400);
    }

    await Session.findByIdAndDelete(id);

    return success(res, { message: 'Session deleted successfully' });
  } catch (err) {
    return error(res, 'Failed to delete session', 500);
  }
};

// PATCH /api/sessions/:id/status
const updateSessionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status: newStatus } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return error(res, 'Invalid session ID format', 400);
    }

    if (!newStatus) {
      return error(res, 'status is required', 400);
    }

    const allStatuses = ['SCHEDULED', 'PRE_SESSION', 'ACTIVE_SESSION', 'POST_SESSION', 'CLOSED'];
    if (!allStatuses.includes(newStatus)) {
      return error(res, 'Invalid status value', 400);
    }

    const session = await Session.findById(id);
    if (!session) {
      return error(res, 'Session not found', 404);
    }

    const currentStatus = session.session_status;
    const allowedTransitions = VALID_TRANSITIONS[currentStatus];

    if (!allowedTransitions.includes(newStatus)) {
      return error(res, `Invalid status transition from ${currentStatus} to ${newStatus}`, 400);
    }

    const now = new Date();
    const setFields = {
      session_status: newStatus,
      updated_at: now,
    };
    if (newStatus === 'CLOSED') {
      setFields.closed_at = now;
    }

    const updated = await Session.findOneAndUpdate(
      { _id: id, session_status: currentStatus },
      { $set: setFields },
      { new: true }
    );

    if (!updated) {
      return error(res, 'State conflict — session status changed. Refresh and retry.', 409);
    }

    try {
      const { getIO } = require('../sockets/io');
      getIO().to(`session_${id}`).emit('session:state_changed', {
        session_id: id,
        new_status: newStatus,
      });
    } catch (_) {}

    return success(res, {
      session: updated.toObject(),
      message: `Session status updated to ${newStatus}`,
    });
  } catch (err) {
    return error(res, err.message || 'Failed to update session status', 500);
  }
};

// GET /api/sessions/:id/participants
const getParticipants = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return error(res, 'Invalid session ID format', 400);
    }

    const session = await Session.findById(id).populate(
      'assigned_participants',
      '_id name email is_active'
    );

    if (!session) {
      return error(res, 'Session not found', 404);
    }

    if (session.access_type === 'PUBLIC') {
      return error(res, 'Public sessions do not have assigned participants', 400);
    }

    return success(res, { participants: session.assigned_participants });
  } catch (err) {
    return error(res, 'Failed to fetch participants', 500);
  }
};

// POST /api/sessions/:id/participants
const addParticipant = async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return error(res, 'Invalid session ID format', 400);
    }

    if (!user_id || !mongoose.Types.ObjectId.isValid(user_id)) {
      return error(res, 'Valid user_id is required', 400);
    }

    const session = await Session.findById(id);
    if (!session) {
      return error(res, 'Session not found', 404);
    }

    if (session.access_type === 'PUBLIC') {
      return error(res, 'Cannot assign participants to a PUBLIC session', 400);
    }

    const user = await User.findById(user_id).select('_id name email is_active').lean();
    if (!user) {
      return error(res, 'User not found', 404);
    }
    if (!user.is_active) {
      return error(res, 'User account is inactive', 400);
    }

    const alreadyAssigned = session.assigned_participants.some(
      (p) => p.toString() === user_id.toString()
    );
    if (alreadyAssigned) {
      return error(res, 'User is already assigned to this session', 400);
    }

    await Session.findByIdAndUpdate(
      id,
      {
        $addToSet: { assigned_participants: user_id },
        $set: { updated_at: new Date() },
      }
    );

    return success(res, {
      message: 'Participant added',
      participant: { _id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    return error(res, 'Failed to add participant', 500);
  }
};

// DELETE /api/sessions/:id/participants/:uid
const removeParticipant = async (req, res) => {
  try {
    const { id, uid } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return error(res, 'Invalid session ID format', 400);
    }

    if (!mongoose.Types.ObjectId.isValid(uid)) {
      return error(res, 'Invalid participant ID format', 400);
    }

    const session = await Session.findById(id);
    if (!session) {
      return error(res, 'Session not found', 404);
    }

    if (session.access_type === 'PUBLIC') {
      return error(res, 'Cannot remove participants from a PUBLIC session', 400);
    }

    const exists = session.assigned_participants.some(
      (p) => p.toString() === uid.toString()
    );
    if (!exists) {
      return error(res, 'Participant not found in this session', 404);
    }

    await Session.findByIdAndUpdate(
      id,
      {
        $pull: { assigned_participants: new mongoose.Types.ObjectId(uid) },
        $set: { updated_at: new Date() },
      }
    );

    try {
      const { getIO } = require('../sockets/io');
      getIO().to(`session_${id}`).emit('participant:revoked', {
        session_id: id,
        user_id: uid,
      });
    } catch (_) {}

    return success(res, { message: 'Participant removed' });
  } catch (err) {
    return error(res, 'Failed to remove participant', 500);
  }
};

module.exports = {
  getSessions,
  createSession,
  getSessionById,
  updateSession,
  deleteSession,
  updateSessionStatus,
  getParticipants,
  addParticipant,
  removeParticipant,
};
