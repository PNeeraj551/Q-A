const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-zA-Z0-9._%+-]+@athivatech\.com$/, 'Email must be an @athivatech.com address'],
    },
    role: {
      type: String,
      enum: ['admin', 'user'],
      required: [true, 'Role is required'],
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    is_root: {
      type: Boolean,
      default: false,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

module.exports = mongoose.model('User', userSchema);
