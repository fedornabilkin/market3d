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
import { authenticateJWT } from '../middleware/auth.js';

const router = express.Router();

router.get('/:clusterId/requests', authenticateJWT, getClusterRequests);
router.get('/printers/:printerId/requests', authenticateJWT, getPrinterRequests);
router.get('/requests/my', authenticateJWT, getMyRequests);
router.post('/:clusterId/printers/:printerId/request', authenticateJWT, clusterPrinterRequestValidation, validate, createRequest);
router.post('/requests/:id/approve', authenticateJWT, approveRequest);
router.post('/requests/:id/reject', authenticateJWT, rejectRequest);
router.post('/requests/:id/cancel', authenticateJWT, cancelRequest);

export default router;


