const mongoose = require('mongoose');
const AdminDM = require('../models/AdminDM');
const User = require('../models/User');
const Session = require('../models/Session');
const { success, error } = require('../utils/responseUtils');
const { getIO } = require('../sockets/io');

// GET /api/admin/dm/:sessionId — list all chat rooms for this admin in this session
async function getSessionChats(req, res) {
  const { sessionId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(sessionId)) {
    return error(res, 'Invalid sessionId', 400);
  }
  try {
    const chats = await AdminDM.find({ session_id: sessionId, admin_id: req.user.user_id })
      .select('participants messages created_at')
      .lean();

    const result = chats.map(c => ({
      _id: c._id,
      participants: c.participants,
      last_message: c.messages.length ? c.messages[c.messages.length - 1] : null,
      message_count: c.messages.length,
      created_at: c.created_at,
    }));

    return success(res, { chats: result });
  } catch (err) {
    return error(res, 'Failed to load chats.', 500);
  }
}

// POST /api/admin/dm/:sessionId — create a new chat room
async function createChat(req, res) {
  const { sessionId } = req.params;
  const { participant_ids } = req.body;

  if (!mongoose.Types.ObjectId.isValid(sessionId)) {
    return error(res, 'Invalid sessionId', 400);
  }
  if (!Array.isArray(participant_ids) || participant_ids.length < 1 || participant_ids.length > 4) {
    return error(res, 'participant_ids must be an array of 1 to 4 IDs', 400);
  }
  if (participant_ids.some(id => !mongoose.Types.ObjectId.isValid(id))) {
    return error(res, 'One or more participant IDs are invalid', 400);
  }

  try {
    const session = await Session.findById(sessionId).lean();
    if (!session) return error(res, 'Session not found', 404);

    const admin = await User.findById(req.user.user_id).select('name').lean();

    const users = await User.find({
      _id: { $in: participant_ids },
      role: 'participant',
      is_active: true,
    }).select('_id name').lean();

    if (users.length !== participant_ids.length) {
      return error(res, 'One or more participants not found or inactive', 404);
    }

    const participants = users.map(u => ({ user_id: u._id, name: u.name }));

    const chat = await AdminDM.create({
      session_id: sessionId,
      admin_id: req.user.user_id,
      participants,
    });

    try {
      participants.forEach(p => {
        getIO().to(`user_${p.user_id}`).emit('private:received', {
          chat_id: chat._id,
          session_id: sessionId,
          sender_name: admin ? admin.name : 'Admin',
        });
      });
    } catch (_) {}

    return success(res, { chat });
  } catch (err) {
    return error(res, 'Failed to create chat.', 500);
  }
}

// POST /api/admin/dm/:chatId/message — admin sends message to chat room
async function sendMessage(req, res) {
  const { chatId } = req.params;
  const { text } = req.body;

  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    return error(res, 'Invalid chatId', 400);
  }
  if (!text || typeof text !== 'string' || !text.trim()) {
    return error(res, 'Message text is required', 400);
  }
  if (text.trim().length > 1000) {
    return error(res, 'Message must be 1000 characters or fewer', 400);
  }

  try {
    const chat = await AdminDM.findOne({ _id: chatId, admin_id: req.user.user_id });
    if (!chat) return error(res, 'Chat not found.', 404);

    const admin = await User.findById(req.user.user_id).select('name').lean();
    const senderName = admin ? admin.name : 'Admin';

    const msg = {
      sender_id: req.user.user_id,
      sender_name: senderName,
      sender_role: 'admin',
      text: text.trim(),
      sent_at: new Date(),
    };
    chat.messages.push(msg);
    await chat.save();

    try {
      chat.participants.forEach(p => {
        getIO().to(`user_${p.user_id}`).emit('private:message', {
          chat_id: chatId,
          session_id: chat.session_id,
          sender_name: senderName,
          sender_role: 'admin',
          text: msg.text,
          sent_at: msg.sent_at,
        });
      });
    } catch (_) {}

    return success(res, { chat });
  } catch (err) {
    return error(res, 'Failed to send message.', 500);
  }
}

// GET /api/sessions/:id/admin-dm — participant gets all their chat rooms for this session
async function participantGetChats(req, res) {
  const sessionId = req.params.id;
  const participantId = req.user.user_id;

  if (!mongoose.Types.ObjectId.isValid(sessionId)) {
    return error(res, 'Invalid sessionId', 400);
  }
  try {
    const chats = await AdminDM.find({
      session_id: sessionId,
      'participants.user_id': participantId,
    }).lean();
    return success(res, { chats });
  } catch (err) {
    return error(res, 'Failed to load chats.', 500);
  }
}

// POST /api/sessions/:id/admin-dm/reply — participant sends message to a chat room
async function participantSendMessage(req, res) {
  const sessionId = req.params.id;
  const participantId = req.user.user_id;
  const { chat_id, text } = req.body;

  if (!text || typeof text !== 'string' || !text.trim()) {
    return error(res, 'Message text is required', 400);
  }
  if (text.trim().length > 1000) {
    return error(res, 'Message must be 1000 characters or fewer', 400);
  }
  if (!mongoose.Types.ObjectId.isValid(sessionId)) {
    return error(res, 'Invalid sessionId', 400);
  }
  if (!chat_id || !mongoose.Types.ObjectId.isValid(chat_id)) {
    return error(res, 'Valid chat_id is required', 400);
  }

  try {
    const chat = await AdminDM.findOne({
      _id: chat_id,
      session_id: sessionId,
      'participants.user_id': participantId,
    });
    if (!chat) return error(res, 'Chat not found or access denied.', 404);

    const participant = chat.participants.find(p => p.user_id.toString() === participantId);
    const senderName = participant ? participant.name : 'Participant';

    const msg = {
      sender_id: participantId,
      sender_name: senderName,
      sender_role: 'participant',
      text: text.trim(),
      sent_at: new Date(),
    };
    chat.messages.push(msg);
    await chat.save();

    try {
      getIO().to(`user_${chat.admin_id}`).emit('private:message', {
        chat_id,
        session_id: sessionId,
        sender_name: senderName,
        sender_role: 'participant',
        text: msg.text,
        sent_at: msg.sent_at,
      });
    } catch (_) {}

    return success(res, { success: true });
  } catch (err) {
    return error(res, 'Failed to send reply.', 500);
  }
}

module.exports = { getSessionChats, createChat, sendMessage, participantGetChats, participantSendMessage };
