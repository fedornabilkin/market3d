import express from 'express';
import {
  getAllDictionaries,
  getDictionaryById,
  createDictionary,
  updateDictionary,
  archiveDictionary,
} from '../controllers/dictionaryController.js';
import {
  getItemsByDictionary,
  getItemsByParent,
  getItemById,
  createItem,
  updateItem,
  deleteItem,
} from '../controllers/dictionaryItemController.js';
import { dictionaryValidation, dictionaryItemValidation, validate } from '../utils/validators/index.js';
import { authenticateJWTWithActivity } from '../middleware/auth.js';

const router = express.Router();

// Dictionary routes
router.get('/', getAllDictionaries);
router.get('/:id', getDictionaryById);
router.post('/', authenticateJWTWithActivity, dictionaryValidation, validate, createDictionary);
router.put('/:id', authenticateJWTWithActivity, dictionaryValidation, validate, updateDictionary);
router.delete('/:id', authenticateJWTWithActivity, archiveDictionary);

// Dictionary items routes
router.get('/:dictionaryName/items', getItemsByDictionary);
router.get('/items/parent/:parentId', getItemsByParent);
router.get('/items/:id', getItemById);
router.post('/:dictionaryName/items', authenticateJWTWithActivity, dictionaryItemValidation, validate, createItem);
router.put('/items/:id', authenticateJWTWithActivity, dictionaryItemValidation, validate, updateItem);
router.delete('/items/:id', authenticateJWTWithActivity, deleteItem);

export default router;

