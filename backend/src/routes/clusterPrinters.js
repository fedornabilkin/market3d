import express from 'express';
import {
  getClusterPrinters,
  attachPrinter,
  detachPrinter,
} from '../controllers/clusterPrinterController.js';
import { authenticateJWTWithActivity } from '../middleware/auth.js';

const router = express.Router();

router.get('/:clusterId/printers', getClusterPrinters);
router.post('/:clusterId/printers/:printerId', authenticateJWTWithActivity, attachPrinter);
router.delete('/:clusterId/printers/:printerId', authenticateJWTWithActivity, detachPrinter);

export default router;


