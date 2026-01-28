import { body } from 'express-validator';

// Кастомная валидация для deadline: дата не должна быть в прошлом и должна быть не ранее завтрашнего дня
const deadlineValidation = (value) => {
  if (!value) {
    throw new Error('Deadline is required');
  }

  const deadline = new Date(value);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  if (deadline < now) {
    throw new Error('Deadline cannot be in the past');
  }

  if (deadline < tomorrow) {
    throw new Error('Deadline must be at least tomorrow');
  }

  return true;
};

export const orderValidation = [
  body('material').notEmpty().withMessage('Material is required'),
  body('colorId').optional().isInt({ min: 1 }).withMessage('Color ID must be a positive integer'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('deadline').custom(deadlineValidation),
  body('description').optional().isString().withMessage('Description must be a string'),
];

export const orderUpdateValidation = [
  body('material').optional().notEmpty().withMessage('Material cannot be empty'),
  body('colorId').optional().isInt({ min: 1 }).withMessage('Color ID must be a positive integer'),
  body('quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('deadline').optional().custom(deadlineValidation),
  body('description').optional().isString().withMessage('Description must be a string'),
];

