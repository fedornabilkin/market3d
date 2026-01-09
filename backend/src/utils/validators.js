import { body, validationResult } from 'express-validator';

export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

export const registerValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

export const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

export const printerValidation = [
  body('modelName').notEmpty().withMessage('Model name is required'),
  body('manufacturer').notEmpty().withMessage('Manufacturer is required'),
  body('pricePerHour').isFloat({ min: 0 }).withMessage('Price per hour must be a positive number'),
  body('state').optional().isIn(['available', 'busy', 'maintenance', 'inactive']).withMessage('Invalid state'),
];

export const orderValidation = [
  body('material').isIn(['PLA', 'ABS', 'PETG', 'TPU', 'NYLON']).withMessage('Material must be one of: PLA, ABS, PETG, TPU, NYLON'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('deadline').isISO8601().withMessage('Deadline must be a valid date'),
  body('description').optional().isString().withMessage('Description must be a string'),
];

export const orderUpdateValidation = [
  body('material').optional().notEmpty().withMessage('Material cannot be empty'),
  body('quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('deadline').optional().isISO8601().withMessage('Deadline must be a valid date'),
  body('totalPrice').optional().isFloat({ min: 0 }).withMessage('Total price must be a positive number'),
  body('description').optional().isString().withMessage('Description must be a string'),
];

export const messageValidation = [
  body('message').notEmpty().trim().isLength({ min: 1, max: 1000 }).withMessage('Message must be between 1 and 1000 characters'),
];

export const verifyEmailValidation = [
  body('code').isLength({ min: 4, max: 4 }).withMessage('Verification code must be 4 digits').isNumeric().withMessage('Verification code must be numeric'),
];

export const emailChangeValidation = [
  body('newEmail').isEmail().normalizeEmail().withMessage('Valid email is required'),
];

export const confirmEmailChangeValidation = [
  body('code').isLength({ min: 4, max: 4 }).withMessage('Verification code must be 4 digits').isNumeric().withMessage('Verification code must be numeric'),
];

export const changePasswordValidation = [
  body('oldPassword').notEmpty().withMessage('Old password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
];

export const updateProfileValidation = [
  // Пока нет полей для обновления, кроме email и пароля, которые обрабатываются отдельно
];

