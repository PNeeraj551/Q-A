const mongoose = require('mongoose');

const qnaPostSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [120, 'Title must be 120 characters or fewer'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description must be 1000 characters or fewer'],
      default: '',
    },
    visibility: {
      type: String,
      enum: ['PUBLIC', 'PRIVATE'],
      required: [true, 'Visibility is required'],
    },
    status: {
      type: String,
      enum: ['OPEN', 'CLOSED'],
      default: 'OPEN',
    },
    allowed_participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
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

qnaPostSchema.index({ visibility: 1 });
qnaPostSchema.index({ allowed_participants: 1 });
qnaPostSchema.index({ created_at: -1 });

module.exports = mongoose.model('QnaPost', qnaPostSchema);
