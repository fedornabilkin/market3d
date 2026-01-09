import { body } from 'express-validator';

export const clusterPrinterRequestValidation = [
  body('message')
    .optional()
    .isString()
    .withMessage('Message must be a string')
    .isLength({ max: 1000 })
    .withMessage('Message must not exceed 1000 characters'),
];


