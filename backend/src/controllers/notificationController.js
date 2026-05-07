const Notification = require('../models/Notification');
const { success, error } = require('../utils/responseUtils');

const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient_id: req.user.user_id })
      .sort({ created_at: -1 })
      .limit(50)
      .lean();
    return success(res, { notifications });
  } catch (err) {
    return error(res, 'Failed to fetch notifications', 500);
  }
};

const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    await Notification.updateOne(
      { _id: id, recipient_id: req.user.user_id },
      { $set: { is_read: true } }
    );
    return success(res, { message: 'Marked as read' });
  } catch (err) {
    return error(res, 'Failed to mark as read', 500);
  }
};

const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient_id: req.user.user_id, is_read: false },
      { $set: { is_read: true } }
    );
    return success(res, { message: 'All marked as read' });
  } catch (err) {
    return error(res, 'Failed to mark all as read', 500);
  }
};

module.exports = { getNotifications, markAsRead, markAllAsRead };
