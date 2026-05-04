const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    session_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      required: true,
    },
    participant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    participant_name: {
      type: String,
      required: true,
    },
    comment_text: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    is_admin_comment: {
      type: Boolean,
      default: false,
    },
    is_hidden: {
      type: Boolean,
      default: false,
    },
    is_deleted: {
      type: Boolean,
      default: false,
    },
    admin_pinned: {
      type: Boolean,
      default: false,
    },
    like_count: {
      type: Number,
      default: 0,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
    updated_at: {
      type: Date,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

commentSchema.index({ session_id: 1, created_at: -1 });
commentSchema.index({ session_id: 1, admin_pinned: 1 });
commentSchema.index({ session_id: 1, is_deleted: 1, created_at: -1 });

module.exports = mongoose.model('Comment', commentSchema);
