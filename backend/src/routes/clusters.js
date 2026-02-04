import express from 'express';
import {
  getAllClusters,
  getMyClusters,
  getActiveClusters,
  getClusterById,
  createCluster,
  updateCluster,
  activateCluster,
  archiveCluster,
} from '../controllers/clusterController.js';
import { getClusterOrders } from '../controllers/orderController.js';
import { clusterValidation, validate } from '../utils/validators/index.js';
import { authenticateJWTWithActivity } from '../middleware/auth.js';

const router = express.Router();

router.get('/', getAllClusters);
router.get('/my', authenticateJWTWithActivity, getMyClusters);
router.get('/active', getActiveClusters);
router.get('/:id', getClusterById);
router.get('/:clusterId/orders', authenticateJWTWithActivity, getClusterOrders);
router.post('/', authenticateJWTWithActivity, clusterValidation, validate, createCluster);
router.put('/:id', authenticateJWTWithActivity, clusterValidation, validate, updateCluster);
router.post('/:id/activate', authenticateJWTWithActivity, activateCluster);
router.post('/:id/archive', authenticateJWTWithActivity, archiveCluster);

export default router;


