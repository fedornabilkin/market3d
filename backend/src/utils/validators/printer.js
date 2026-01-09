import { body } from 'express-validator';

export const printerValidation = [
  body('modelName').notEmpty().withMessage('Model name is required'),
  body('manufacturer').notEmpty().withMessage('Manufacturer is required'),
  body('pricePerHour').isFloat({ min: 0 }).withMessage('Price per hour must be a positive number'),
  body('state').optional().isIn(['available', 'busy', 'maintenance', 'inactive', 'archived']).withMessage('Invalid state'),
];

