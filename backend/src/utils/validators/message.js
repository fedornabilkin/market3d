import { body } from 'express-validator';

export const messageValidation = [
  body('message').notEmpty().trim().isLength({ min: 1, max: 1000 }).withMessage('Message must be between 1 and 1000 characters'),
];

