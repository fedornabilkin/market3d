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
import { authenticateJWT } from '../middleware/auth.js';
import { uploadMultiple } from '../middleware/upload.js';

const router = express.Router();

router.get('/', authenticateJWT, getAllOrders);
router.get('/recent', getRecentOrders);
router.get('/:id', authenticateJWT, getOrderById);
router.post('/', authenticateJWT, orderValidation, validate, saveOrder);
router.put('/:id', authenticateJWT, orderUpdateValidation, validate, saveOrder);
router.post('/:id/submit', authenticateJWT, submitOrder);
router.put('/:id/state', authenticateJWT, updateOrderState);
router.post('/:id/archive', authenticateJWT, archiveOrder);

// File routes
router.post('/:orderId/files', authenticateJWT, uploadMultiple.array('files', 10), uploadOrderFiles);
router.get('/:orderId/files', authenticateJWT, getOrderFiles);
router.get('/:orderId/files/:fileId/download', authenticateJWT, downloadOrderFile);
router.delete('/:orderId/files/:fileId', authenticateJWT, deleteOrderFile);

export default router;

