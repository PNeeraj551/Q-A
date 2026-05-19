const { verifyToken } = require('../utils/jwtUtils');
const User = require('../models/User');

const initSocketHandler = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      if (!token) return next(new Error('Unauthorized'));

      const decoded = verifyToken(token);
      const user = await User.findById(decoded.user_id);
      if (!user || !user.is_active) return next(new Error('Unauthorized'));

      socket.user = { ...decoded, name: user.name };
      return next();
    } catch (err) {
      return next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.join('qna_global');

    socket.on('qna:join', ({ qna_id } = {}) => {
      if (qna_id && typeof qna_id === 'string' && qna_id.trim()) {
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
