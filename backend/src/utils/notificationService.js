const Notification = require('../models/Notification');
const { getIO } = require('../sockets/io');

/**
 * Sends a notification to a specific user via DB and Socket.IO
 * 
 * @param {string} recipientId - The ID of the user receiving the notification
 * @param {string} message - The content of the notification
 * @param {string} type - Enum: 'REMINDER', 'INVITE', 'SYSTEM'
 * @param {string} [sessionId] - Optional session reference
 */
const sendNotification = async ({ recipientId, message, type = 'REMINDER', sessionId = null }) => {
  try {
    // Persist to database
    const notification = await Notification.create({
      recipient_id: recipientId,
      message,
      type,
      session_id: sessionId
    });

    // Push real-time update via Socket.IO
    const io = getIO();
    if (io) {
      io.to(`user_${recipientId}`).emit('notification:new', {
        _id: notification._id,
        message,
        type,
        session_id: sessionId,
        created_at: notification.created_at,
        is_read: false
      });
    }

    return notification;
  } catch (err) {
    console.error('[NotificationService] Error:', err.message);
    throw err;
  }
};

module.exports = { sendNotification };
