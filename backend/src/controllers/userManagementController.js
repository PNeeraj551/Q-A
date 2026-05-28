'use strict';
const crypto = require('crypto');
const User = require('../models/User');
const { success, error } = require('../utils/responseUtils');
const logger = require('../utils/logger');
const { logAction, ACTIONS } = require('../services/auditService');

const ATHIVA_EMAIL = /^[a-zA-Z0-9._%+-]+@athivatech\.com$/i;

function adminMeta(req) {
  return {
    adminId: req.user.user_id,
    adminEmail: req.user.email,
    ip: req.ip,
  };
}

// GET /admin/users
const listUsers = async (req, res) => {
  try {
    const { search } = req.query;
    const users = await User.findAll(search || '');
    return success(res, { users });
  } catch (err) {
    logger.error('listUsers error', { err: err.message });
    return error(res, 'Failed to load users.', 500);
  }
};

// POST /admin/users
const createUser = async (req, res) => {
  const { name, email, role } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return error(res, 'Name is required', 400);
  }
  if (!email || typeof email !== 'string' || !ATHIVA_EMAIL.test(email.trim())) {
    return error(res, 'A valid @athivatech.com email is required', 400);
  }
  if (!role || !['admin', 'user'].includes(role)) {
    return error(res, 'Role must be admin or user', 400);
  }

  const normalEmail = email.trim().toLowerCase();

  try {
    const existing = await User.findByEmailRaw(normalEmail);
    if (existing) return error(res, 'A user with this email already exists', 409);

    const user = await User.create({
      name: name.trim(),
      email: normalEmail,
      role,
      is_active: true,
      status: 'VERIFIED',
    });

    const meta = adminMeta(req);
    logger.info('user created', { userId: user.id, email: user.email, role: user.role, createdBy: meta.adminId });
    await logAction({
      action: ACTIONS.USER_CREATED,
      targetUserId: user.id,
      targetUserEmail: user.email,
      ...meta,
      metadata: { role },
    });

    return success(res, { user }, 201);
  } catch (err) {
    logger.error('createUser error', { err: err.message });
    return error(res, 'Failed to create user.', 500);
  }
};

// PATCH /admin/users/:id  — edit name / role only
const updateUser = async (req, res) => {
  const { id } = req.params;
  const { name, role } = req.body;

  try {
    const user = await User.findById(id);
    if (!user) return error(res, 'User not found', 404);
    if (user.is_root && role !== undefined) return error(res, 'Root admin role cannot be changed', 403);
    if (user.status === 'DELETED') return error(res, 'Deleted users cannot be edited', 403);

    const updates = {};

    if (name !== undefined) {
      const trimmed = (name || '').trim();
      if (!trimmed) return error(res, 'Name is required', 400);
      if (trimmed.length > 80) return error(res, 'Name must be 80 characters or fewer', 400);
      updates.name = trimmed;
    }
    if (role !== undefined) {
      if (!['admin', 'user'].includes(role)) return error(res, 'Role must be admin or user', 400);
      updates.role = role;
    }

    if (Object.keys(updates).length === 0) return error(res, 'No fields to update', 400);

    const updated = await User.updateById(id, updates);

    const meta = adminMeta(req);
    logger.info('user updated', { userId: id, updates, updatedBy: meta.adminId });
    await logAction({
      action: ACTIONS.USER_UPDATED,
      targetUserId: user.id,
      targetUserEmail: user.email,
      ...meta,
      metadata: { fields: Object.keys(updates) },
    });

    return success(res, { user: updated });
  } catch (err) {
    logger.error('updateUser error', { err: err.message, userId: id });
    return error(res, 'Failed to update user.', 500);
  }
};

// DELETE /admin/users/:id  — soft delete
const deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    const user = await User.findById(id);
    if (!user) return error(res, 'User not found', 404);
    if (user.is_root) return error(res, 'Root admin cannot be deleted', 403);
    if (user.status === 'DELETED') return error(res, 'User is already deleted', 409);
    if (id === req.user.user_id) return error(res, 'Cannot delete your own account', 403);

    const now = new Date().toISOString();
    await User.updateById(id, {
      status: 'DELETED',
      is_active: false,
      deleted_at: now,
    });

    const meta = adminMeta(req);
    logger.info('user soft-deleted', { userId: id, deletedBy: meta.adminId });
    await logAction({
      action: ACTIONS.USER_SOFT_DELETED,
      targetUserId: user.id,
      targetUserEmail: user.email,
      ...meta,
    });

    return success(res, { message: 'User deleted' });
  } catch (err) {
    logger.error('deleteUser error', { err: err.message, userId: id });
    return error(res, 'Failed to delete user.', 500);
  }
};

module.exports = { listUsers, createUser, updateUser, deleteUser };
