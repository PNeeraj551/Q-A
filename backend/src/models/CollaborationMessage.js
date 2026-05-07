const mongoose = require('mongoose');

const collaborationMessageSchema = new mongoose.Schema(
  {
    group_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'CollaborationGroup', required: true },
    sender_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sender_name:  { type: String, required: true },
    message_text: { type: String, required: true, maxlength: 500, trim: true },
    created_at:   { type: Date, default: Date.now },
  },
  { timestamps: false, versionKey: false }
);

collaborationMessageSchema.index({ group_id: 1, created_at: 1 });

module.exports = mongoose.model('CollaborationMessage', collaborationMessageSchema);
