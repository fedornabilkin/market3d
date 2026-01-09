import { body } from 'express-validator';

export const dictionaryValidation = [
  body('name').notEmpty().withMessage('Dictionary name is required').isLength({ max: 255 }).withMessage('Dictionary name must be less than 255 characters'),
  body('description').optional().isString().withMessage('Description must be a string'),
  body('state').optional().isIn(['active', 'draft', 'archived']).withMessage('Invalid state'),
];

export const dictionaryItemValidation = [
  body('name').notEmpty().withMessage('Item name is required').isLength({ max: 255 }).withMessage('Item name must be less than 255 characters'),
];

