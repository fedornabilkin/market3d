import express from 'express';
import { getOrderMessages, createMessage } from '../controllers/messageController.js';
import { messageValidation, validate } from '../utils/validators/index.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = express.Router();

router.get('/:orderId/messages', authenticateJWT, getOrderMessages);
router.post('/:orderId/messages', authenticateJWT, messageValidation, validate, createMessage);

export default router;

