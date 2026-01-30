import { body } from 'express-validator';

export const printerValidation = [
  body('modelName').notEmpty().withMessage('Model name is required'),
  body('manufacturer').notEmpty().withMessage('Manufacturer is required'),
  body('pricePerHour').isInt({ min: 1 }).withMessage('Price per hour must be a positive integer'),
  body('maxSizeX').isInt({ min: 1 }).withMessage('Max size X must be a positive integer (in millimeters)'),
  body('maxSizeY').isInt({ min: 1 }).withMessage('Max size Y must be a positive integer (in millimeters)'),
  body('maxSizeZ').isInt({ min: 1 }).withMessage('Max size Z must be a positive integer (in millimeters)'),
  body('state').optional().isIn(['available', 'busy', 'maintenance', 'inactive', 'archived']).withMessage('Invalid state'),
];

