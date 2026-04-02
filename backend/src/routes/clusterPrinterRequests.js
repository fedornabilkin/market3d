import express from 'express';
import {
  getClusterRequests,
  getPrinterRequests,
  getMyRequests,
  createRequest,
  approveRequest,
  rejectRequest,
  cancelRequest,
} from '../controllers/clusterPrinterRequestController.js';
import { clusterPrinterRequestValidation, validate } from '../utils/validators/index.js';
import { authenticateJWTWithActivity } from '../middleware/auth.js';

const router = express.Router();

router.get('/:clusterId/requests', authenticateJWTWithActivity, getClusterRequests);
router.get('/printers/:printerId/requests', authenticateJWTWithActivity, getPrinterRequests);
router.get('/requests/my', authenticateJWTWithActivity, getMyRequests);
router.post('/:clusterId/printers/:printerId/request', authenticateJWTWithActivity, clusterPrinterRequestValidation, validate, createRequest);
router.post('/requests/:id/approve', authenticateJWTWithActivity, approveRequest);
router.post('/requests/:id/reject', authenticateJWTWithActivity, rejectRequest);
router.post('/requests/:id/cancel', authenticateJWTWithActivity, cancelRequest);

export default router;


