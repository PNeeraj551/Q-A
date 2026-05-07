const mongoose = require('mongoose');
const { verifyToken } = require('../utils/jwtUtils');
const User = require('../models/User');
const Session = require('../models/Session');

// in-memory presence: Map<sessionId, Map<userId, { name, role, join_time, socket_id }>>
const sessionPresence = new Map();

function getPresenceList(sessionId) {
  const room = sessionPresence.get(sessionId);
  if (!room) return [];
  return Array.from(room.values()).map(p => ({
    user_id: p.user_id,
    name: p.name,
    role: p.role,
    join_time: p.join_time,
    is_online: true,
  }));
}

function addPresence(sessionId, userId, entry) {
  if (!sessionPresence.has(sessionId)) sessionPresence.set(sessionId, new Map());
  sessionPresence.get(sessionId).set(userId, entry);
}

function removePresence(socketId) {
  const affected = [];
  sessionPresence.forEach((room, sessionId) => {
    room.forEach((entry, userId) => {
      if (entry.socket_id === socketId) {
        room.delete(userId);
        affected.push(sessionId);
      }
    });
    if (room.size === 0) sessionPresence.delete(sessionId);
  });
  return affected;
}

const initSocketHandler = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      if (!token) return next(new Error('Unauthorized'));

      const decoded = verifyToken(token);
      if (!decoded) return next(new Error('Unauthorized'));

      const user = await User.findById(decoded.user_id).select('_id name is_active').lean();
      if (!user || !user.is_active) return next(new Error('Unauthorized'));

      socket.user = { ...decoded, name: user.name };
      return next();
    } catch (err) {
      return next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    // Join a room for targeted notifications
    if (socket.user && socket.user.user_id) {
      socket.join(`user_${socket.user.user_id}`);
    }

    socket.on('session:join', async ({ session_id } = {}) => {
      if (!session_id || !mongoose.Types.ObjectId.isValid(session_id)) {
        socket.emit('error', { message: 'Invalid session ID' });
        return;
      }

      try {
        const session = await Session.findById(session_id).lean();
        if (!session) { socket.emit('error', { message: 'Session not found' }); return; }

        if (session.session_status === 'CLOSED' && socket.user.role !== 'admin') {
          socket.emit('error', { message: 'Session is closed' });
          return;
        }

        let allowed = false;
        if (session.access_type === 'PUBLIC') {
          allowed = true;
        } else if (session.access_type === 'PRIVATE') {
          if (socket.user.role === 'admin') {
            allowed = true;
          } else {
            const participantIds = session.assigned_participants.map(p => p.toString());
            allowed = participantIds.includes(socket.user.user_id.toString());
          }
        }

        if (!allowed) { socket.emit('error', { message: 'Access denied' }); return; }

        socket.join(`session_${session_id}`);

        addPresence(session_id, socket.user.user_id.toString(), {
          user_id:            socket.user.user_id,
          name:               socket.user.name,
          role:               socket.user.role,
          join_time:          new Date(),
          last_activity_time: new Date(),
          socket_id:          socket.id,
        });

        io.to(`session_${session_id}`).emit('peer:presence_update', {
          participants: getPresenceList(session_id),
        });

        try {
          const SessionActivity = require('../models/SessionActivity');
          SessionActivity.create({ session_id, timestamp: new Date(), event_type: 'join' }).catch(() => {});
          io.to(`session_${session_id}`).emit('analytics:activity');
        } catch (_) {}
      } catch (err) {
        socket.emit('error', { message: 'Failed to join session' });
      }
    });

    socket.on('session:leave', ({ session_id } = {}) => {
      if (session_id) {
        socket.leave(`session_${session_id}`);
        const room = sessionPresence.get(session_id);
        if (room) {
          room.forEach((entry, userId) => {
            if (entry.socket_id === socket.id) room.delete(userId);
          });
          io.to(`session_${session_id}`).emit('peer:presence_update', {
            participants: getPresenceList(session_id),
          });
        }
      }
    });

    socket.on('peer:join_room', ({ coordination_id } = {}) => {
      if (coordination_id && mongoose.Types.ObjectId.isValid(coordination_id)) {
        socket.join(`peer_${coordination_id}`);
      }
    });

    socket.on('peer:leave_room', ({ coordination_id } = {}) => {
      if (coordination_id) {
        socket.leave(`peer_${coordination_id}`);
      }
    });

    socket.on('collab:join', ({ group_id } = {}) => {
      if (group_id && mongoose.Types.ObjectId.isValid(group_id)) {
        socket.join(`collab_group_${group_id}`);
      }
    });

    socket.on('collab:leave', ({ group_id } = {}) => {
      if (group_id) {
        socket.leave(`collab_group_${group_id}`);
      }
    });

    socket.on('disconnect', () => {
      const affectedSessions = removePresence(socket.id);
      affectedSessions.forEach(sessionId => {
        io.to(`session_${sessionId}`).emit('peer:presence_update', {
          participants: getPresenceList(sessionId),
        });
      });
    });
  });
};

function getSessionPresence(sessionId) {
  return getPresenceList(sessionId);
}

function updateLastActivity(sessionId, userId) {
  const room = sessionPresence.get(sessionId);
  if (!room) return;
  const entry = room.get(userId.toString());
  if (!entry) return;
  entry.last_activity_time = new Date();
  try {
    const { getIO } = require('./io');
    getIO().to(`session_${sessionId}`).emit('analytics:activity');
  } catch (_) {}
}

function getPresenceSnapshot(sessionId) {
  const room = sessionPresence.get(sessionId);
  if (!room) return [];
  return Array.from(room.values());
}

module.exports = { initSocketHandler, getSessionPresence, updateLastActivity, getPresenceSnapshot };
