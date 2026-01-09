import express from 'express';
import {
  getClusterPrinters,
  attachPrinter,
  detachPrinter,
} from '../controllers/clusterPrinterController.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = express.Router();

router.get('/:clusterId/printers', getClusterPrinters);
router.post('/:clusterId/printers/:printerId', authenticateJWT, attachPrinter);
router.delete('/:clusterId/printers/:printerId', authenticateJWT, detachPrinter);

export default router;


