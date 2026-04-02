import express from 'express';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from '../controllers/notificationController.js';
import { authenticateJWTWithActivity } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateJWTWithActivity, getNotifications);
router.get('/unread-count', authenticateJWTWithActivity, getUnreadCount);
router.put('/:id/read', authenticateJWTWithActivity, markAsRead);
router.put('/read-all', authenticateJWTWithActivity, markAllAsRead);

export default router;
