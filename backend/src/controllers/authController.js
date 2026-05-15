const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { signToken } = require('../utils/jwtUtils');
const { success, error } = require('../utils/responseUtils');

const NAME_MAX = 80;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    return error(res, 'A valid email address is required', 400);
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    return error(res, 'Password must be at least 6 characters', 400);
  }

  const reqId = Date.now();
  console.time(`login-total-${reqId}`);

  try {
    console.time(`db-query-${reqId}`);
    const user = await User.findOne({ email: email.trim().toLowerCase(), is_active: true });
    console.timeEnd(`db-query-${reqId}`);

    if (!user) return error(res, 'Invalid email or password', 401);

    console.time(`bcrypt-${reqId}`);
    const isMatch = await bcrypt.compare(password, user.password);
    console.timeEnd(`bcrypt-${reqId}`);

    if (!isMatch) return error(res, 'Invalid email or password', 401);

    const token = signToken({
      user_id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      must_change_password: user.must_change_password,
    });

    console.timeEnd(`login-total-${reqId}`);
    return success(res, {
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        must_change_password: user.must_change_password,
      },
    });
  } catch (err) {
    console.timeEnd(`login-total-${reqId}`);
    return error(res, 'Login failed. Please try again.', 500);
  }
};

const me = async (req, res) => {
  try {
    const user = await User.findById(req.user.user_id)
      .select('_id name email role is_active must_change_password created_at');

    if (!user) return error(res, 'User not found', 404);

    return success(res, {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      is_active: user.is_active,
      must_change_password: user.must_change_password,
      created_at: user.created_at,
    });
  } catch (err) {
    return error(res, 'Failed to retrieve user profile.', 500);
  }
};

const logout = (req, res) => success(res, { message: 'Logged out' });

const updateMe = async (req, res) => {
  const { name, email } = req.body;

  try {
    const user = await User.findById(req.user.user_id);
    if (!user) return error(res, 'User not found', 404);

    if (name !== undefined) {
      const trimmed = (name || '').trim();
      if (!trimmed) return error(res, 'Name is required', 400);
      if (trimmed.length > NAME_MAX) return error(res, `Name must be ${NAME_MAX} characters or fewer`, 400);
      user.name = trimmed;
    }

    if (email !== undefined) {
      const trimmed = (email || '').trim().toLowerCase();
      if (!trimmed || !EMAIL_REGEX.test(trimmed)) return error(res, 'A valid email address is required', 400);
      if (trimmed !== user.email) {
        const exists = await User.findOne({ email: trimmed, _id: { $ne: user._id } });
        if (exists) return error(res, 'Email is already in use', 409);
        user.email = trimmed;
      }
    }

    await user.save();

    return success(res, {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      is_active: user.is_active,
      must_change_password: user.must_change_password,
      created_at: user.created_at,
    });
  } catch (err) {
    return error(res, 'Failed to update profile.', 500);
  }
};

const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || typeof currentPassword !== 'string') {
    return error(res, 'Current password is required', 400);
  }

  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    return error(res, 'New password must be at least 6 characters', 400);
  }

  try {
    const user = await User.findById(req.user.user_id);
    if (!user) return error(res, 'User not found', 404);

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return error(res, 'Current password is incorrect', 401);

    user.password = await bcrypt.hash(newPassword, 10);
    user.must_change_password = false;
    await user.save();

    return success(res, { message: 'Password updated successfully' });
  } catch (err) {
    return error(res, 'Failed to change password.', 500);
  }
};

module.exports = { login, me, logout, updateMe, changePassword };
