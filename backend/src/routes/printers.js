import express from 'express';
import {
  getAllPrinters,
  getPrinterById,
  savePrinter,
  archivePrinter,
  getRecentPrinters,
  addPrinterMaterials,
  removePrinterMaterials,
  addPrinterColors,
  removePrinterColors,
} from '../controllers/printerController.js';
import { printerValidation, validate } from '../utils/validators/index.js';
import { authenticateJWTWithActivity } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateJWTWithActivity, getAllPrinters);
router.get('/recent', getRecentPrinters);
router.get('/:id', authenticateJWTWithActivity, getPrinterById);
router.post('/', authenticateJWTWithActivity, printerValidation, validate, savePrinter);
router.put('/:id', authenticateJWTWithActivity, printerValidation, validate, savePrinter);
router.post('/:id/archive', authenticateJWTWithActivity, archivePrinter);
router.post('/:id/materials', authenticateJWTWithActivity, addPrinterMaterials);
router.delete('/:id/materials', authenticateJWTWithActivity, removePrinterMaterials);
router.post('/:id/colors', authenticateJWTWithActivity, addPrinterColors);
router.delete('/:id/colors', authenticateJWTWithActivity, removePrinterColors);

export default router;

