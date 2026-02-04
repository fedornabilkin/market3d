import express from 'express';
import {
  getUserAddresses,
  getPrinterAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
} from '../controllers/addressController.js';
import { authenticateJWTWithActivity } from '../middleware/auth.js';

const router = express.Router();

router.get('/user/:userId', authenticateJWTWithActivity, getUserAddresses);
router.get('/printer/:printerId', getPrinterAddresses);
router.post('/', authenticateJWTWithActivity, createAddress);
router.put('/:id', authenticateJWTWithActivity, updateAddress);
router.delete('/:id', authenticateJWTWithActivity, deleteAddress);

export default router;

