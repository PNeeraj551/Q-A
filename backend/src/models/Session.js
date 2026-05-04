const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema(
  {
    session_title: {
      type: String,
      required: [true, 'Session title is required'],
      maxlength: [120, 'Session title cannot exceed 120 characters'],
      trim: true,
    },
    session_description: {
      type: String,
      maxlength: [500, 'Session description cannot exceed 500 characters'],
      trim: true,
    },
    planned_date: {
      type: Date,
      required: [true, 'Planned date is required'],
    },
    planned_start_time: {
      type: Date,
      required: [true, 'Planned start time is required'],
    },
    planned_end_time: {
      type: Date,
      required: [true, 'Planned end time is required'],
    },
    access_type: {
      type: String,
      enum: ['PUBLIC', 'PRIVATE'],
      required: [true, 'Access type is required'],
    },
    session_status: {
      type: String,
      enum: ['SCHEDULED', 'PRE_SESSION', 'ACTIVE_SESSION', 'POST_SESSION', 'CLOSED'],
      default: 'SCHEDULED',
    },
    pre_session_enabled: {
      type: Boolean,
      default: false,
    },
    pre_session_minutes: {
      type: Number,
      default: 0,
    },
    assigned_participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Created by is required'],
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
    updated_at: {
      type: Date,
    },
    closed_at: {
      type: Date,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

sessionSchema.index({ session_status: 1 });
sessionSchema.index({ planned_start_time: 1 });
sessionSchema.index({ session_title: 'text' });
sessionSchema.index({ access_type: 1 });

module.exports = mongoose.model('Session', sessionSchema);
