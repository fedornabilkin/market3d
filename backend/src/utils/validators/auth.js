import { body } from 'express-validator';

export const registerValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

export const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
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

