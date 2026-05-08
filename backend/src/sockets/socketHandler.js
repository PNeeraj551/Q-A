const mongoose = require('mongoose');
const { verifyToken } = require('../utils/jwtUtils');
const User = require('../models/User');

const initSocketHandler = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      if (!token) return next(new Error('Unauthorized'));

      const decoded = verifyToken(token);
      const user = await User.findById(decoded.user_id).select('_id name is_active').lean();
      if (!user || !user.is_active) return next(new Error('Unauthorized'));

      socket.user = { ...decoded, name: user.name };
      return next();
    } catch (err) {
      return next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('qna:join', ({ qna_id } = {}) => {
      if (qna_id && mongoose.Types.ObjectId.isValid(qna_id)) {
        socket.join(`qna_${qna_id}`);
      }
    });

    socket.on('qna:leave', ({ qna_id } = {}) => {
      if (qna_id) {
        socket.leave(`qna_${qna_id}`);
      }
    });
  });
};

module.exports = { initSocketHandler };
