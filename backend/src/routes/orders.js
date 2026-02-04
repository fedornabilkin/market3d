import express from 'express';
import {
  getAllOrders,
  getOrderById,
  saveOrder,
  archiveOrder,
  submitOrder,
  updateOrderState,
  getRecentOrders,
} from '../controllers/orderController.js';
import {
  uploadOrderFiles,
  getOrderFiles,
  deleteOrderFile,
  downloadOrderFile,
} from '../controllers/orderFileController.js';
import { orderValidation, orderUpdateValidation, validate } from '../utils/validators/index.js';
import { authenticateJWTWithActivity } from '../middleware/auth.js';
import { uploadMultiple } from '../middleware/upload.js';

const router = express.Router();

router.get('/', authenticateJWTWithActivity, getAllOrders);
router.get('/recent', getRecentOrders);
router.get('/:id', authenticateJWTWithActivity, getOrderById);
router.post('/', authenticateJWTWithActivity, orderValidation, validate, saveOrder);
router.put('/:id', authenticateJWTWithActivity, orderUpdateValidation, validate, saveOrder);
router.post('/:id/submit', authenticateJWTWithActivity, submitOrder);
router.put('/:id/state', authenticateJWTWithActivity, updateOrderState);
router.post('/:id/archive', authenticateJWTWithActivity, archiveOrder);

// File routes
router.post('/:orderId/files', authenticateJWTWithActivity, uploadMultiple.array('files', 10), uploadOrderFiles);
router.get('/:orderId/files', authenticateJWTWithActivity, getOrderFiles);
router.get('/:orderId/files/:fileId/download', authenticateJWTWithActivity, downloadOrderFile);
router.delete('/:orderId/files/:fileId', authenticateJWTWithActivity, deleteOrderFile);

export default router;

