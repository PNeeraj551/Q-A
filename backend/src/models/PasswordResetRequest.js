const mongoose = require('mongoose');

const passwordResetRequestSchema = new mongoose.Schema({
  participant_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  participant_name: {
    type: String,
    required: true,
  },
  participant_email: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'resolved'],
    default: 'pending',
  },
  requested_at: {
    type: Date,
    default: Date.now,
  },
  resolved_at: {
    type: Date,
  },
});

module.exports = mongoose.model('PasswordResetRequest', passwordResetRequestSchema);
