import express from 'express';
import {
  getUserAddresses,
  getPrinterAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
} from '../controllers/addressController.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = express.Router();

router.get('/user/:userId', authenticateJWT, getUserAddresses);
router.get('/printer/:printerId', getPrinterAddresses);
router.post('/', authenticateJWT, createAddress);
router.put('/:id', authenticateJWT, updateAddress);
router.delete('/:id', authenticateJWT, deleteAddress);

export default router;

