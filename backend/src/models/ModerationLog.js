const mongoose = require('mongoose');

const moderationLogSchema = new mongoose.Schema(
  {
    session_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      required: true,
    },
    comment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
    },
    action_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action_type: {
      type: String,
      enum: ['HIDE', 'UNHIDE', 'DELETE', 'PIN', 'UNPIN', 'PARTICIPANT_REMOVED'],
      required: true,
    },
    target_participant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    note: {
      type: String,
    },
    actioned_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

moderationLogSchema.index({ session_id: 1, actioned_at: -1 });

module.exports = mongoose.model('ModerationLog', moderationLogSchema);
