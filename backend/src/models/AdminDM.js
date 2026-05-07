const mongoose = require('mongoose');
const { Schema } = mongoose;
const ObjectId = Schema.Types.ObjectId;

const dmMessageSchema = new Schema({
  sender_id:   { type: ObjectId, ref: 'User', required: true },
  sender_name: { type: String, required: true },
  sender_role: { type: String, enum: ['admin', 'participant'], required: true },
  text:        { type: String, required: true, maxlength: 1000, trim: true },
  sent_at:     { type: Date, default: Date.now },
}, { _id: false });

const adminDMSchema = new Schema({
  session_id:   { type: ObjectId, ref: 'Session', required: true },
  admin_id:     { type: ObjectId, ref: 'User', required: true },
  participants: [{
    user_id: { type: ObjectId, ref: 'User' },
    name:    { type: String },
  }],
  messages:    { type: [dmMessageSchema], default: [] },
  created_at:  { type: Date, default: Date.now },
}, { timestamps: false, versionKey: false });

adminDMSchema.index({ session_id: 1, admin_id: 1 });

module.exports = mongoose.model('AdminDM', adminDMSchema);
