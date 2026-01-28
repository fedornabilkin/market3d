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
import { authenticateJWT } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateJWT, getAllPrinters);
router.get('/recent', getRecentPrinters);
router.get('/:id', authenticateJWT, getPrinterById);
router.post('/', authenticateJWT, printerValidation, validate, savePrinter);
router.put('/:id', authenticateJWT, printerValidation, validate, savePrinter);
router.post('/:id/archive', authenticateJWT, archivePrinter);
router.post('/:id/materials', authenticateJWT, addPrinterMaterials);
router.delete('/:id/materials', authenticateJWT, removePrinterMaterials);
router.post('/:id/colors', authenticateJWT, addPrinterColors);
router.delete('/:id/colors', authenticateJWT, removePrinterColors);

export default router;

