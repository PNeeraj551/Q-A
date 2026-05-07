const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['REMINDER', 'INVITE', 'SYSTEM'],
      default: 'REMINDER',
    },
    session_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
    },
    is_read: {
      type: Boolean,
      default: false,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    versionKey: false,
  }
);

notificationSchema.index({ recipient_id: 1, created_at: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
