const mongoose = require('mongoose');

const participantEntrySchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name:    { type: String, required: true },
  },
  { _id: false }
);

const collaborationGroupSchema = new mongoose.Schema(
  {
    session_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
    group_name:   { type: String, required: false, default: 'Group Chat', maxlength: 50, trim: true },
    participants: { type: [participantEntrySchema], required: true },
    created_by:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    is_active:    { type: Boolean, default: true },
    created_at:   { type: Date, default: Date.now },
  },
  { timestamps: false, versionKey: false }
);

collaborationGroupSchema.index({ session_id: 1 });
collaborationGroupSchema.index({ 'participants.user_id': 1 });

module.exports = mongoose.model('CollaborationGroup', collaborationGroupSchema);
