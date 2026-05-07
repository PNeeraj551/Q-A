const mongoose = require('mongoose');
const CollaborationGroup = require('../models/CollaborationGroup');
const CollaborationMessage = require('../models/CollaborationMessage');
const Session = require('../models/Session');
const User = require('../models/User');
const Comment = require('../models/Comment');
const { success, error } = require('../utils/responseUtils');
const { getIO } = require('../sockets/io');

function isMember(group, userId) {
  return group.participants.some(p => p.user_id.toString() === userId.toString());
}

async function resolveName(req) {
  if (req.user.name) return req.user.name;
  const u = await User.findById(req.user.user_id).select('name').lean();
  return u?.name || 'Participant';
}

// POST /api/collaboration/groups
async function createGroup(req, res) {
  const { session_id, participant_ids } = req.body;

  if (!session_id || !Array.isArray(participant_ids)) {
    return error(res, 'session_id and participant_ids are required', 400);
  }
  if (!mongoose.Types.ObjectId.isValid(session_id)) {
    return error(res, 'Invalid session_id', 400);
  }

  const selfId = req.user.user_id.toString();

  // Deduplicate and remove self from participant_ids
  const otherIds = [...new Set(participant_ids.map(id => id.toString()))].filter(id => id !== selfId);

  const total = otherIds.length + 1;
  if (total < 2) return error(res, 'At least one other participant is required', 400);
  if (total > 5) return error(res, 'Groups support a maximum of 5 participants', 400);

  for (const id of otherIds) {
    if (!mongoose.Types.ObjectId.isValid(id)) return error(res, `Invalid participant_id: ${id}`, 400);
  }

  try {
    const session = await Session.findById(session_id).lean();
    if (!session) return error(res, 'Session not found', 404);
    if (!['PRE_SESSION', 'ACTIVE_SESSION'].includes(session.session_status)) {
      return error(res, 'Groups can only be created during PRE_SESSION or ACTIVE_SESSION', 400);
    }

    const otherUsers = await User.find({ _id: { $in: otherIds } }).select('name').lean();
    if (otherUsers.length !== otherIds.length) {
      return error(res, 'One or more participants not found', 404);
    }

    const selfName = await resolveName(req);

    const participants = [
      { user_id: selfId, name: selfName },
      ...otherUsers.map(u => ({ user_id: u._id, name: u.name })),
    ];

    const group = await CollaborationGroup.create({
      session_id,
      participants,
      created_by: selfId,
    });

    try {
      const io = getIO();
      for (const p of participants) {
        io.to(`user_${p.user_id}`).emit('collab:group_created', {
          group_id: group._id,
          group_name: group.group_name,
          session_id,
        });
      }
    } catch (_) {}

    return success(res, { group }, 201);
  } catch (err) {
    if (err.name === 'ValidationError') {
      return error(res, Object.values(err.errors).map(e => e.message).join(', '), 400);
    }
    console.error('[collaboration] createGroup error:', err.message);
    return error(res, 'Failed to create group', 500);
  }
}

// GET /api/collaboration/groups/session/:sessionId
async function getMyGroups(req, res) {
  const { sessionId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(sessionId)) return error(res, 'Invalid session ID', 400);

  try {
    const groups = await CollaborationGroup.find({
      session_id: sessionId,
      is_active: true,
      'participants.user_id': req.user.user_id,
    }).lean();

    return success(res, { groups });
  } catch (err) {
    return error(res, 'Failed to load groups', 500);
  }
}

// GET /api/collaboration/groups/:groupId/messages
async function getMessages(req, res) {
  const { groupId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(groupId)) return error(res, 'Invalid group ID', 400);

  try {
    const group = await CollaborationGroup.findById(groupId).lean();
    if (!group) return error(res, 'Group not found', 404);
    if (!isMember(group, req.user.user_id)) return error(res, 'Access denied', 403);

    const messages = await CollaborationMessage.find({ group_id: groupId })
      .sort({ created_at: 1 })
      .limit(100)
      .lean();

    return success(res, { messages });
  } catch (err) {
    return error(res, 'Failed to load messages', 500);
  }
}

// POST /api/collaboration/groups/:groupId/messages
async function sendMessage(req, res) {
  const { groupId } = req.params;
  const { message_text } = req.body;

  if (!mongoose.Types.ObjectId.isValid(groupId)) return error(res, 'Invalid group ID', 400);
  if (!message_text || !message_text.trim()) return error(res, 'message_text is required', 400);
  if (message_text.trim().length > 500) return error(res, 'message_text cannot exceed 500 characters', 400);

  try {
    const group = await CollaborationGroup.findById(groupId).lean();
    if (!group) return error(res, 'Group not found', 404);
    if (!isMember(group, req.user.user_id)) return error(res, 'Access denied', 403);
    if (!group.is_active) return error(res, 'Group is no longer active', 400);

    const session = await Session.findById(group.session_id).lean();
    if (!session || !['PRE_SESSION', 'ACTIVE_SESSION'].includes(session.session_status)) {
      return error(res, 'Session is not accepting messages', 400);
    }

    const senderName = await resolveName(req);

    const message = await CollaborationMessage.create({
      group_id: groupId,
      sender_id: req.user.user_id,
      sender_name: senderName,
      message_text: message_text.trim(),
    });

    try {
      getIO().to(`collab_group_${groupId}`).emit('collab:message', {
        group_id: groupId,
        sender_name: senderName,
        message_text: message.message_text,
        created_at: message.created_at,
      });
    } catch (_) {}

    try {
      const { updateLastActivity } = require('../sockets/socketHandler');
      const SessionActivity = require('../models/SessionActivity');
      updateLastActivity(group.session_id.toString(), req.user.user_id);
      SessionActivity.create({
        session_id: group.session_id,
        timestamp: new Date(),
        event_type: 'collab_message',
      }).catch(() => {});
    } catch (_) {}

    return success(res, { message }, 201);
  } catch (err) {
    if (err.name === 'ValidationError') {
      return error(res, Object.values(err.errors).map(e => e.message).join(', '), 400);
    }
    return error(res, 'Failed to send message', 500);
  }
}

// POST /api/collaboration/groups/:groupId/leave
async function leaveGroup(req, res) {
  const { groupId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(groupId)) return error(res, 'Invalid group ID', 400);

  try {
    const group = await CollaborationGroup.findById(groupId);
    if (!group) return error(res, 'Group not found', 404);
    if (!isMember(group, req.user.user_id)) return error(res, 'Access denied', 403);

    const userName = group.participants.find(
      p => p.user_id.toString() === req.user.user_id.toString()
    )?.name || 'Participant';

    group.participants = group.participants.filter(
      p => p.user_id.toString() !== req.user.user_id.toString()
    );
    if (group.participants.length === 0) group.is_active = false;
    await group.save();

    try {
      getIO().to(`collab_group_${groupId}`).emit('collab:member_left', { sender_name: userName });
    } catch (_) {}

    return success(res, { message: 'Left group' });
  } catch (err) {
    return error(res, 'Failed to leave group', 500);
  }
}

// POST /api/collaboration/groups/:groupId/submit-question
async function submitQuestion(req, res) {
  const { groupId } = req.params;
  const { question_text } = req.body;

  if (!mongoose.Types.ObjectId.isValid(groupId)) return error(res, 'Invalid group ID', 400);
  if (!question_text || !question_text.trim()) return error(res, 'question_text is required', 400);
  if (question_text.trim().length > 1000) return error(res, 'question_text cannot exceed 1000 characters', 400);

  try {
    const group = await CollaborationGroup.findById(groupId).lean();
    if (!group) return error(res, 'Group not found', 404);
    if (!isMember(group, req.user.user_id)) return error(res, 'Access denied', 403);
    if (!group.is_active) return error(res, 'Group is no longer active', 400);

    const session = await Session.findById(group.session_id).lean();
    if (!session || session.session_status !== 'ACTIVE_SESSION') {
      return error(res, 'Questions can only be submitted during an active session', 400);
    }

    const participantName = await resolveName(req);

    const comment = await Comment.create({
      session_id: group.session_id,
      participant_id: req.user.user_id,
      participant_name: participantName,
      comment_text: question_text.trim(),
      is_admin_comment: false,
    });

    try {
      const io = getIO();
      io.to(`session_${group.session_id}`).emit('comment:new', { comment });
      io.to(`collab_group_${groupId}`).emit('collab:question_submitted', { comment_id: comment._id });
    } catch (_) {}

    return success(res, { comment }, 201);
  } catch (err) {
    if (err.name === 'ValidationError') {
      return error(res, Object.values(err.errors).map(e => e.message).join(', '), 400);
    }
    return error(res, 'Failed to submit question', 500);
  }
}

module.exports = { createGroup, getMyGroups, getMessages, sendMessage, leaveGroup, submitQuestion };
