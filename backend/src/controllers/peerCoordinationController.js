const mongoose = require('mongoose');
const PeerCoordination = require('../models/PeerCoordination');
const Comment = require('../models/Comment');
const Session = require('../models/Session');
const { success, error } = require('../utils/responseUtils');
const { getIO } = require('../sockets/io');

const ADMIN_FIELDS = '_id session_id initiator_name target_name status consolidated_question_submitted started_at';

function isInvolved(coord, userId) {
  return (
    coord.initiator_id.toString() === userId.toString() ||
    coord.target_id.toString() === userId.toString()
  );
}

async function getActiveCount(sessionId) {
  return PeerCoordination.countDocuments({ session_id: sessionId, status: 'ACTIVE' });
}

// POST /api/peer-coordination
async function startCoordination(req, res) {
  const { session_id, target_id } = req.body;
  if (!session_id || !target_id) return error(res, 'session_id and target_id are required', 400);
  if (!mongoose.Types.ObjectId.isValid(session_id) || !mongoose.Types.ObjectId.isValid(target_id))
    return error(res, 'Invalid ID', 400);

  const initiatorId = req.user.user_id;
  if (initiatorId.toString() === target_id.toString())
    return error(res, 'Cannot coordinate with yourself', 400);

  try {
    const session = await Session.findById(session_id).lean();
    if (!session) return error(res, 'Session not found', 404);
    if (session.session_status !== 'ACTIVE_SESSION')
      return error(res, 'Session is not live', 400);

    const existing = await PeerCoordination.findOne({
      session_id,
      status: 'ACTIVE',
      $or: [
        { initiator_id: initiatorId, target_id },
        { initiator_id: target_id, target_id: initiatorId },
      ],
    }).lean();
    if (existing) return error(res, 'An active coordination already exists with this participant', 409);

    const [targetUser, initiatorUser] = await Promise.all([
      require('../models/User').findById(target_id).select('name').lean(),
      req.user.name ? null : require('../models/User').findById(initiatorId).select('name').lean(),
    ]);
    if (!targetUser) return error(res, 'Target participant not found', 404);
    const initiatorName = req.user.name || initiatorUser?.name || 'Participant';

    const coord = await PeerCoordination.create({
      session_id,
      initiator_id: initiatorId,
      initiator_name: initiatorName,
      target_id,
      target_name: targetUser.name,
    });

    try {
      const io = getIO();
      io.to(`session_${session_id}`).emit('peer:started', {
        coordination_id: coord._id,
        initiator_id: initiatorId.toString(),
        target_id: target_id.toString(),
        initiator_name: initiatorName,
        target_name: targetUser.name,
      });
      const active_count = await getActiveCount(session_id);
      io.to(`session_${session_id}`).emit('peer:count_update', { active_count });
    } catch (_) {}

    return success(res, { coordination: coord }, 201);
  } catch (err) {
    return error(res, 'Failed to start coordination', 500);
  }
}

// GET /api/peer-coordination/session/:sessionId
async function listBySession(req, res) {
  const { sessionId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(sessionId)) return error(res, 'Invalid session ID', 400);

  try {
    if (req.user.role === 'admin') {
      const coordinations = await PeerCoordination.find({ session_id: sessionId })
        .select(ADMIN_FIELDS)
        .sort({ started_at: -1 })
        .lean();
      const active_count = coordinations.filter(c => c.status === 'ACTIVE').length;
      const coordinated_questions_count = coordinations.filter(c => c.consolidated_question_submitted).length;
      return success(res, {
        coordinations,
        active_count,
        total_count: coordinations.length,
        coordinated_questions_count,
      });
    }

    const userId = req.user.user_id;
    const coordinations = await PeerCoordination.find({
      session_id: sessionId,
      $or: [{ initiator_id: userId }, { target_id: userId }],
    })
      .sort({ started_at: -1 })
      .lean();

    const sanitized = coordinations.map(c => ({
      _id: c._id,
      initiator_name: c.initiator_name,
      target_name: c.target_name,
      status: c.status,
      consolidated_question_submitted: c.consolidated_question_submitted,
      started_at: c.started_at,
      notes: c.notes.map(n => ({ sender_name: n.sender_name, text: n.text, sent_at: n.sent_at })),
    }));

    return success(res, { coordinations: sanitized });
  } catch (err) {
    return error(res, 'Failed to load coordinations', 500);
  }
}

// GET /api/peer-coordination/:id
async function getCoordination(req, res) {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return error(res, 'Invalid ID', 400);

  try {
    const coord = await PeerCoordination.findById(id).lean();
    if (!coord) return error(res, 'Coordination not found', 404);
    if (!isInvolved(coord, req.user.user_id)) return error(res, 'Access denied', 403);

    return success(res, { coordination: coord });
  } catch (err) {
    return error(res, 'Failed to load coordination', 500);
  }
}

// POST /api/peer-coordination/:id/note
async function addNote(req, res) {
  const { id } = req.params;
  const { text } = req.body;
  if (!mongoose.Types.ObjectId.isValid(id)) return error(res, 'Invalid ID', 400);
  if (!text || !text.trim()) return error(res, 'Note text is required', 400);
  if (text.trim().length > 500) return error(res, 'Note too long (max 500 chars)', 400);

  try {
    const coord = await PeerCoordination.findById(id);
    if (!coord) return error(res, 'Coordination not found', 404);
    if (!isInvolved(coord, req.user.user_id)) return error(res, 'Access denied', 403);
    if (coord.status === 'CLOSED') return error(res, 'Coordination is closed', 400);

    const senderName = req.user.name ||
      (await require('../models/User').findById(req.user.user_id).select('name').lean())?.name ||
      'Participant';

    const note = { sender_id: req.user.user_id, sender_name: senderName, text: text.trim(), sent_at: new Date() };
    coord.notes.push(note);
    await coord.save();

    const emittedNote = { sender_name: senderName, text: note.text, sent_at: note.sent_at };
    try {
      const io = getIO();
      io.to(`peer_${id}`).emit('peer:note', emittedNote);
    } catch (_) {}

    try {
      const { updateLastActivity } = require('../sockets/socketHandler');
      const SessionActivity = require('../models/SessionActivity');
      updateLastActivity(coord.session_id.toString(), req.user.user_id);
      SessionActivity.create({ session_id: coord.session_id, timestamp: new Date(), event_type: 'peer_interaction' }).catch(() => {});
    } catch (_) {}

    return success(res, { note: emittedNote });
  } catch (err) {
    return error(res, 'Failed to add note', 500);
  }
}

// POST /api/peer-coordination/:id/submit-question
async function submitQuestion(req, res) {
  const { id } = req.params;
  const { question_text } = req.body;
  if (!mongoose.Types.ObjectId.isValid(id)) return error(res, 'Invalid ID', 400);
  if (!question_text || !question_text.trim()) return error(res, 'Question text is required', 400);

  try {
    const coord = await PeerCoordination.findById(id);
    if (!coord) return error(res, 'Coordination not found', 404);
    if (!isInvolved(coord, req.user.user_id)) return error(res, 'Access denied', 403);
    if (coord.status === 'CLOSED') return error(res, 'Coordination is closed', 400);
    if (coord.consolidated_question_submitted) return error(res, 'Question already submitted', 409);

    const participantName = req.user.name ||
      (await require('../models/User').findById(req.user.user_id).select('name').lean())?.name ||
      'Participant';

    const comment = await Comment.create({
      session_id: coord.session_id,
      participant_id: req.user.user_id,
      participant_name: participantName,
      comment_text: question_text.trim(),
      is_coordinated_submission: true,
      coordination_id: coord._id,
    });

    coord.consolidated_question_submitted = true;
    coord.consolidated_question_id = comment._id;
    await coord.save();

    try {
      const io = getIO();
      io.to(`session_${coord.session_id}`).emit('comment:new', { comment });
      io.to(`peer_${id}`).emit('peer:question_submitted', { comment_id: comment._id });
      const active_count = await getActiveCount(coord.session_id.toString());
      io.to(`session_${coord.session_id}`).emit('peer:count_update', { active_count });
    } catch (_) {}

    return success(res, { comment }, 201);
  } catch (err) {
    return error(res, 'Failed to submit question', 500);
  }
}

// PATCH /api/peer-coordination/:id/close
async function closeCoordination(req, res) {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return error(res, 'Invalid ID', 400);

  try {
    const coord = await PeerCoordination.findById(id);
    if (!coord) return error(res, 'Coordination not found', 404);
    if (!isInvolved(coord, req.user.user_id)) return error(res, 'Access denied', 403);
    if (coord.status === 'CLOSED') return error(res, 'Already closed', 400);

    coord.status = 'CLOSED';
    coord.ended_at = new Date();
    await coord.save();

    try {
      const io = getIO();
      io.to(`peer_${id}`).emit('peer:closed', { coordination_id: id });
      const active_count = await getActiveCount(coord.session_id.toString());
      io.to(`session_${coord.session_id}`).emit('peer:count_update', { active_count });
    } catch (_) {}

    return success(res, { message: 'Coordination closed' });
  } catch (err) {
    return error(res, 'Failed to close coordination', 500);
  }
}

module.exports = {
  startCoordination,
  listBySession,
  getCoordination,
  addNote,
  submitQuestion,
  closeCoordination,
};
