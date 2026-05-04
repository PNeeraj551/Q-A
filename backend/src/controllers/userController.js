const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { success, error } = require('../utils/responseUtils');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Shape a user document into the standard response object (no password)
const formatUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  is_active: user.is_active,
  created_at: user.created_at,
});

// GET /api/users
// Query: ?search=<name_or_email>  (optional, case-insensitive partial)
const getUsers = async (req, res) => {
  try {
    const { search } = req.query;

    let filter = {};
    if (search && typeof search === 'string' && search.trim().length > 0) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      filter = { $or: [{ name: regex }, { email: regex }] };
    }

    const users = await User.find(filter).select('-password').lean();

    return success(res, { users: users.map(formatUser) });
  } catch (err) {
    return error(res, 'Failed to retrieve users', 500);
  }
};

// POST /api/users
const createUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // --- Validation ---
    if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) {
      return error(res, 'Name is required and must be between 2 and 80 characters', 400);
    }

    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      return error(res, 'A valid email address is required', 400);
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return error(res, 'Password must be at least 6 characters', 400);
    }

    if (!role || !['admin', 'participant'].includes(role)) {
      return error(res, 'Role must be either admin or participant', 400);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      role,
      is_active: true,
    });

    return success(res, { user: formatUser(user) }, 201);
  } catch (err) {
    if (err.code === 11000) {
      return error(res, 'Email already in use', 409);
    }
    return error(res, 'Failed to create user', 500);
  }
};

// PATCH /api/users/:id
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Catch invalid ObjectId early
    if (!id.match(/^[a-fA-F0-9]{24}$/)) {
      return error(res, 'Invalid user ID', 400);
    }

    const { name, email, is_active } = req.body;
    const updates = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) {
        return error(res, 'Name must be between 2 and 80 characters', 400);
      }
      updates.name = name.trim();
    }

    if (email !== undefined) {
      if (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
        return error(res, 'A valid email address is required', 400);
      }
      updates.email = email.trim().toLowerCase();
    }

    if (is_active !== undefined) {
      if (typeof is_active !== 'boolean') {
        return error(res, 'is_active must be a boolean', 400);
      }
      updates.is_active = is_active;
    }

    if (Object.keys(updates).length === 0) {
      return error(res, 'At least one field must be provided', 400);
    }

    const user = await User.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return error(res, 'User not found', 404);
    }

    return success(res, { user: formatUser(user) });
  } catch (err) {
    if (err.code === 11000) {
      return error(res, 'Email already in use', 409);
    }
    if (err.name === 'CastError') {
      return error(res, 'Invalid user ID', 400);
    }
    return error(res, 'Failed to update user', 500);
  }
};

// DELETE /api/users/:id  — soft delete (sets is_active: false)
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Catch invalid ObjectId early
    if (!id.match(/^[a-fA-F0-9]{24}$/)) {
      return error(res, 'Invalid user ID', 400);
    }

    // Prevent admin from deactivating their own account
    if (req.user.user_id === id) {
      return error(res, 'You cannot deactivate your own account', 400);
    }

    const user = await User.findByIdAndUpdate(
      id,
      { $set: { is_active: false } },
      { new: true }
    ).select('-password');

    if (!user) {
      return error(res, 'User not found', 404);
    }

    return success(res, { message: 'User deactivated' });
  } catch (err) {
    if (err.name === 'CastError') {
      return error(res, 'Invalid user ID', 400);
    }
    return error(res, 'Failed to deactivate user', 500);
  }
};

module.exports = { getUsers, createUser, updateUser, deleteUser };
