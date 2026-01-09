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
import { authenticateJWT } from '../middleware/auth.js';

const router = express.Router();

// Dictionary routes
router.get('/', getAllDictionaries);
router.get('/:id', getDictionaryById);
router.post('/', authenticateJWT, dictionaryValidation, validate, createDictionary);
router.put('/:id', authenticateJWT, dictionaryValidation, validate, updateDictionary);
router.delete('/:id', authenticateJWT, archiveDictionary);

// Dictionary items routes
router.get('/:dictionaryName/items', getItemsByDictionary);
router.get('/items/parent/:parentId', getItemsByParent);
router.get('/items/:id', getItemById);
router.post('/:dictionaryName/items', authenticateJWT, dictionaryItemValidation, validate, createItem);
router.put('/items/:id', authenticateJWT, dictionaryItemValidation, validate, updateItem);
router.delete('/items/:id', authenticateJWT, deleteItem);

export default router;

