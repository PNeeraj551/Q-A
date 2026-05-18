const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema(
  {
    qna_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'QnaPost',
      required: true,
    },
    text: {
      type: String,
      required: [true, 'Question text is required'],
      trim: true,
      maxlength: [5000, 'Question must be 5000 characters or fewer'],
    },
    author_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    author_name: {
      type: String,
      required: true,
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    likes_count: {
      type: Number,
      default: 0,
    },
    reply_count: {
      type: Number,
      default: 0,
    },
    accepted_reply_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Reply',
      default: null,
    },
    view_count: {
      type: Number,
      default: 0,
    },
    is_deleted: {
      type: Boolean,
      default: false,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
    updated_at: {
      type: Date,
    },
  },
  { timestamps: false, versionKey: false }
);

// Primary index for sorted feed
questionSchema.index({ qna_id: 1, is_deleted: 1, likes_count: -1, created_at: -1 });
questionSchema.index({ qna_id: 1, author_id: 1 });

module.exports = mongoose.model('Question', questionSchema);
