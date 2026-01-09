import express from 'express';
import { register, login, getProfile, verifyEmail, requestNewVerificationCode, requestEmailChange, confirmEmailChange, updateProfile, changePassword } from '../controllers/authController.js';
import { registerValidation, loginValidation, verifyEmailValidation, emailChangeValidation, confirmEmailChangeValidation, changePasswordValidation, updateProfileValidation, validate } from '../utils/validators/index.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', registerValidation, validate, register);
router.post('/login', loginValidation, validate, login);
router.get('/profile', authenticateJWT, getProfile);
router.put('/profile', authenticateJWT, updateProfileValidation, validate, updateProfile);
router.post('/verify-email', authenticateJWT, verifyEmailValidation, validate, verifyEmail);
router.post('/request-new-code', authenticateJWT, requestNewVerificationCode);
router.post('/request-email-change', authenticateJWT, emailChangeValidation, validate, requestEmailChange);
router.post('/confirm-email-change', authenticateJWT, confirmEmailChangeValidation, validate, confirmEmailChange);
router.post('/change-password', authenticateJWT, changePasswordValidation, validate, changePassword);

export default router;

