import Notification from '../models/Notification.js';

export const getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;
    const isRead = req.query.isRead !== undefined ? req.query.isRead === 'true' : undefined;

    const filters = {
      limit,
      offset,
      isRead,
    };

    const notifications = await Notification.findByUserId(userId, filters);
    res.json(notifications);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;
    const count = await Notification.getUnreadCount(userId);
    res.json({ count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = parseInt(req.params.id);

    const notification = await Notification.markAsRead(notificationId, userId);
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found or access denied' });
    }

    res.json(notification);
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const notifications = await Notification.markAllAsRead(userId);
    res.json({ message: 'All notifications marked as read', count: notifications.length });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
