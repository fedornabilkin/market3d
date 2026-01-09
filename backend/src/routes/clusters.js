import express from 'express';
import {
  getAllClusters,
  getActiveClusters,
  getClusterById,
  createCluster,
  updateCluster,
  activateCluster,
  archiveCluster,
} from '../controllers/clusterController.js';
import { getClusterOrders } from '../controllers/orderController.js';
import { clusterValidation, validate } from '../utils/validators/index.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = express.Router();

router.get('/', getAllClusters);
router.get('/active', getActiveClusters);
router.get('/:id', getClusterById);
router.get('/:clusterId/orders', authenticateJWT, getClusterOrders);
router.post('/', authenticateJWT, clusterValidation, validate, createCluster);
router.put('/:id', authenticateJWT, clusterValidation, validate, updateCluster);
router.post('/:id/activate', authenticateJWT, activateCluster);
router.post('/:id/archive', authenticateJWT, archiveCluster);

export default router;


