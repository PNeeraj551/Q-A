const mongoose = require('mongoose');

const sessionActivitySchema = new mongoose.Schema(
  {
    session_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
    timestamp:  { type: Date, required: true, default: Date.now },
    event_type: { type: String, enum: ['comment', 'peer_interaction', 'join', 'collab_message'], required: true },
  },
  { timestamps: false, versionKey: false }
);

sessionActivitySchema.index({ session_id: 1, timestamp: 1 });
sessionActivitySchema.index({ timestamp: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

module.exports = mongoose.model('SessionActivity', sessionActivitySchema);
