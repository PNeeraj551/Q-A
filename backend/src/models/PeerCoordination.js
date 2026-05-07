const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema(
  {
    sender_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sender_name: { type: String, required: true },
    text: { type: String, required: true, maxlength: 500, trim: true },
    sent_at: { type: Date, default: Date.now },
  },
  { _id: false, versionKey: false }
);

const peerCoordinationSchema = new mongoose.Schema(
  {
    session_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
    initiator_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    initiator_name: { type: String, required: true },
    target_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    target_name: { type: String, required: true },
    status: { type: String, enum: ['ACTIVE', 'CLOSED'], default: 'ACTIVE' },
    notes: [noteSchema],
    consolidated_question_submitted: { type: Boolean, default: false },
    consolidated_question_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },
    started_at: { type: Date, default: Date.now },
    ended_at: { type: Date, default: null },
  },
  { timestamps: false, versionKey: false }
);

peerCoordinationSchema.index({ session_id: 1, status: 1 });
peerCoordinationSchema.index({ initiator_id: 1 });
peerCoordinationSchema.index({ target_id: 1 });

module.exports = mongoose.model('PeerCoordination', peerCoordinationSchema);
