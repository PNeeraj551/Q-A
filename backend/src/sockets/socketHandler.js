const mongoose = require('mongoose');
const { verifyToken } = require('../utils/jwtUtils');
const User = require('../models/User');
const Session = require('../models/Session');

const initSocketHandler = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Unauthorized'));
      }

      const decoded = verifyToken(token);
      if (!decoded) {
        return next(new Error('Unauthorized'));
      }

      const user = await User.findById(decoded.user_id).select('_id is_active').lean();
      if (!user || !user.is_active) {
        return next(new Error('Unauthorized'));
      }

      socket.user = decoded;
      return next();
    } catch (err) {
      return next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('session:join', async ({ session_id } = {}) => {
      if (!session_id || !mongoose.Types.ObjectId.isValid(session_id)) {
        socket.emit('error', { message: 'Invalid session ID' });
        return;
      }

      try {
        const session = await Session.findById(session_id).lean();

        if (!session) {
          socket.emit('error', { message: 'Session not found' });
          return;
        }

        if (session.session_status === 'CLOSED' && socket.user.role !== 'admin') {
          socket.emit('error', { message: 'Session is closed' });
          return;
        }

        if (session.access_type === 'PUBLIC') {
          socket.join(`session_${session_id}`);
          return;
        }

        if (session.access_type === 'PRIVATE') {
          if (socket.user.role === 'admin') {
            socket.join(`session_${session_id}`);
            return;
          }

          const participantIds = session.assigned_participants.map((p) => p.toString());
          if (!participantIds.includes(socket.user.user_id.toString())) {
            socket.emit('error', { message: 'Access denied' });
            return;
          }

          socket.join(`session_${session_id}`);
          return;
        }

        socket.emit('error', { message: 'Access denied' });
      } catch (err) {
        socket.emit('error', { message: 'Failed to join session' });
      }
    });

    socket.on('session:leave', ({ session_id } = {}) => {
      if (session_id) {
        socket.leave(`session_${session_id}`);
      }
    });
  });
};

module.exports = { initSocketHandler };
