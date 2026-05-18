const User = require('../models/User');
const { success, error } = require('../utils/responseUtils');
const logger = require('../utils/logger');

const ATHIVA_EMAIL = /^[a-zA-Z0-9._%+-]+@athivatech\.com$/i;

const formatUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  is_active: user.is_active,
  is_root: user.is_root,
  created_at: user.created_at,
});

// GET /api/users
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
    const { name, email, role } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) {
      return error(res, 'Name is required and must be between 2 and 80 characters', 400);
    }

    if (!email || typeof email !== 'string' || !ATHIVA_EMAIL.test(email.trim())) {
      return error(res, 'A valid @athivatech.com email address is required', 400);
    }

    if (!role || !['admin', 'user'].includes(role)) {
      return error(res, 'Role must be either admin or user', 400);
    }

    const user = await User.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
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

// PATCH /api/users/:id  — name and is_active only; email is immutable
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[a-fA-F0-9]{24}$/)) {
      return error(res, 'Invalid user ID', 400);
    }

    const { name, is_active } = req.body;
    const updates = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) {
        return error(res, 'Name must be between 2 and 80 characters', 400);
      }
      updates.name = name.trim();
    }

    if (is_active !== undefined) {
      if (typeof is_active !== 'boolean') {
        return error(res, 'is_active must be a boolean', 400);
      }
      updates.is_active = is_active;
    }

    delete updates.is_root;

    if (Object.keys(updates).length === 0) {
      return error(res, 'At least one field must be provided', 400);
    }

    const target = await User.findById(id).select('is_root').lean();
    if (!target) return error(res, 'User not found', 404);

    if (target.is_root) {
      if (updates.is_active === false) {
        logger.warn(`[updateUser] Blocked — attempt to deactivate root admin by user ${req.user.user_id}`);
        return error(res, 'Root admin account cannot be deactivated', 403);
      }
      if (updates.role !== undefined) {
        logger.warn(`[updateUser] Blocked — attempt to change root admin role by user ${req.user.user_id}`);
        return error(res, 'Root admin role cannot be changed', 403);
      }
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
    if (err.name === 'CastError') {
      return error(res, 'Invalid user ID', 400);
    }
    return error(res, 'Failed to update user', 500);
  }
};

// DELETE /api/users/:id
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[a-fA-F0-9]{24}$/)) {
      return error(res, 'Invalid user ID', 400);
    }

    if (req.user.user_id === id) {
      return error(res, 'You cannot delete your own account', 400);
    }

    const target = await User.findById(id).select('is_root').lean();
    if (!target) return error(res, 'User not found', 404);

    if (target.is_root) {
      logger.warn(`[deleteUser] Blocked — root admin deletion attempt by user ${req.user.user_id}`);
      return error(res, 'Root admin account cannot be deleted', 403);
    }

    await User.findByIdAndDelete(id);

    return success(res, { message: 'User deleted' });
  } catch (err) {
    if (err.name === 'CastError') {
      return error(res, 'Invalid user ID', 400);
    }
    return error(res, 'Failed to delete user', 500);
  }
};

module.exports = { getUsers, createUser, updateUser, deleteUser };
