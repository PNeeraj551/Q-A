const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { signToken } = require('../utils/jwtUtils');
const { success, error } = require('../utils/responseUtils');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    return error(res, 'A valid email address is required', 400);
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    return error(res, 'Password must be at least 6 characters', 400);
  }

  try {
    const user = await User.findOne({ email: email.trim().toLowerCase(), is_active: true });

    if (!user) {
      return error(res, 'Invalid email or password', 401);
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return error(res, 'Invalid email or password', 401);
    }

    const payload = {
      user_id: user._id.toString(),
      email: user.email,
      role: user.role,
    };

    const token = signToken(payload);

    return success(res, {
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    return error(res, 'Login failed. Please try again.', 500);
  }
};

const me = async (req, res) => {
  try {
    const user = await User.findById(req.user.user_id).select(
      '_id name email role is_active created_at'
    );

    if (!user) {
      return error(res, 'User not found', 404);
    }

    return success(res, {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      is_active: user.is_active,
      created_at: user.created_at,
    });
  } catch (err) {
    return error(res, 'Failed to retrieve user profile.', 500);
  }
};

const logout = (req, res) => {
  return success(res, { message: 'Logged out' });
};

module.exports = { login, me, logout };
