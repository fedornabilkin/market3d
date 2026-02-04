import express from 'express';
import { register, login, getProfile, verifyEmail, requestNewVerificationCode, requestEmailChange, confirmEmailChange, updateProfile, changePassword } from '../controllers/authController.js';
import { registerValidation, loginValidation, verifyEmailValidation, emailChangeValidation, confirmEmailChangeValidation, changePasswordValidation, updateProfileValidation, validate } from '../utils/validators/index.js';
import { authenticateJWTWithActivity } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', registerValidation, validate, register);
router.post('/login', loginValidation, validate, login);
router.get('/profile', authenticateJWTWithActivity, getProfile);
router.put('/profile', authenticateJWTWithActivity, updateProfileValidation, validate, updateProfile);
router.post('/verify-email', authenticateJWTWithActivity, verifyEmailValidation, validate, verifyEmail);
router.post('/request-new-code', authenticateJWTWithActivity, requestNewVerificationCode);
router.post('/request-email-change', authenticateJWTWithActivity, emailChangeValidation, validate, requestEmailChange);
router.post('/confirm-email-change', authenticateJWTWithActivity, confirmEmailChangeValidation, validate, confirmEmailChange);
router.post('/change-password', authenticateJWTWithActivity, changePasswordValidation, validate, changePassword);

export default router;

