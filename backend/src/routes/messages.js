import express from 'express';
import { getOrderMessages, createMessage } from '../controllers/messageController.js';
import { messageValidation, validate } from '../utils/validators/index.js';
import { authenticateJWTWithActivity } from '../middleware/auth.js';

const router = express.Router();

router.get('/:orderId/order', authenticateJWTWithActivity, getOrderMessages);
router.post('/:orderId/order', authenticateJWTWithActivity, messageValidation, validate, createMessage);

export default router;

