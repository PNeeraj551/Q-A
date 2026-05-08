const mongoose = require('mongoose');

const replySchema = new mongoose.Schema(
  {
    question_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      required: true,
    },
    qna_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'QnaPost',
      required: true,
    },
    text: {
      type: String,
      required: [true, 'Reply text is required'],
      trim: true,
      maxlength: [1000, 'Reply must be 1000 characters or fewer'],
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

replySchema.index({ question_id: 1, is_deleted: 1, created_at: 1 });
replySchema.index({ qna_id: 1 });

module.exports = mongoose.model('Reply', replySchema);
