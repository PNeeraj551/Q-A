const mongoose = require('mongoose');
const Session = require('../models/Session');
const { error } = require('../utils/responseUtils');

const sessionAccessGuard = async (req, res, next) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return error(res, 'Invalid session ID format', 400);
  }

  let session;
  try {
    session = await Session.findById(id);
  } catch (err) {
    return error(res, 'Failed to fetch session', 500);
  }

  if (!session) {
    return error(res, 'Session not found', 404);
  }

  const isAdmin = req.user.role === 'admin';

  if (session.session_status === 'CLOSED' && !isAdmin) {
    return error(res, 'Access denied to this session', 403);
  }

  if (session.access_type === 'PUBLIC') {
    req.session = session;
    return next();
  }

  if (session.access_type === 'PRIVATE') {
    if (isAdmin) {
      req.session = session;
      return next();
    }

    const participantIds = session.assigned_participants.map((p) => p.toString());
    if (!participantIds.includes(req.user.user_id.toString())) {
      return error(res, 'Access denied to this session', 403);
    }

    req.session = session;
    return next();
  }

  return error(res, 'Access denied to this session', 403);
};

module.exports = sessionAccessGuard;
