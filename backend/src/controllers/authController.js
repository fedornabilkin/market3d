import bcrypt from 'bcryptjs';
import passport from 'passport';
import User from '../models/User.js';
import { generateToken } from '../middleware/auth.js';
import { generateVerificationCode, generateExpirationDate, isCodeExpired } from '../utils/verification.js';
import { sendEmailNotification } from '../services/notification.js';

export const register = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Проверяем, существует ли пользователь
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Генерируем соль
    const passwordSalt = User.generateSalt();
    
    // Хешируем пароль с солью
    const saltedPassword = password + passwordSalt;
    const passwordHash = await bcrypt.hash(saltedPassword, 10);

    // Генерируем код верификации email
    const verificationCode = generateVerificationCode();
    const expiresAt = generateExpirationDate(1); // 1 час

    // Создаем пользователя
    const user = await User.create({
      email,
      passwordHash,
      passwordSalt,
    });

    // Сохраняем код верификации
    await User.update(user.id, {
      emailVerificationCode: verificationCode,
      emailVerificationCodeExpiresAt: expiresAt,
      emailVerified: false,
    });

    // Выводим код в console.log для разработки
    console.log(`[EMAIL VERIFICATION] User ${email} verification code: ${verificationCode}`);

    // Генерируем токен
    const token = generateToken(user);

    res.status(201).json({
      message: 'User registered successfully. Please verify your email.',
      token,
      user: {
        id: user.id,
        email: user.email,
        emailVerified: false,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error1' });
  }
};

export const login = async (req, res, next) => {
  passport.authenticate('local', { session: false }, (err, user, info) => {
    if (err) {
      return res.status(500).json({ error: 'Internal server error' });
    }
    if (!user) {
      return res.status(401).json({ error: info.message || 'Invalid credentials' });
    }

    const token = generateToken(user);
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
      },
    });
  })(req, res, next);
};

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({
      id: user.id,
      email: user.email,
      emailVerified: user.email_verified || false,
      createdAt: user.created_at,
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user.id;

    if (!code) {
      return res.status(400).json({ error: 'Verification code is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.email_verified) {
      return res.status(400).json({ error: 'Email is already verified' });
    }

    if (!user.email_verification_code) {
      return res.status(400).json({ error: 'No verification code found. Please request a new one.' });
    }

    if (isCodeExpired(user.email_verification_code_expires_at)) {
      return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
    }

    if (user.email_verification_code !== code) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Обновляем статус верификации
    await User.update(userId, {
      emailVerified: true,
      emailVerificationCode: null,
      emailVerificationCodeExpiresAt: null,
    });

    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const requestNewVerificationCode = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.email_verified) {
      return res.status(400).json({ error: 'Email is already verified' });
    }

    // Проверяем таймер (1 минута = 60 секунд)
    if (user.last_code_request_at) {
      const lastRequestTime = new Date(user.last_code_request_at);
      const now = new Date();
      const diffSeconds = Math.floor((now - lastRequestTime) / 1000);
      
      if (diffSeconds < 60) {
        const remainingSeconds = 60 - diffSeconds;
        return res.status(429).json({ 
          error: 'Please wait before requesting a new code',
          remainingSeconds 
        });
      }
    }

    // Генерируем новый код
    const verificationCode = generateVerificationCode();
    const expiresAt = generateExpirationDate(1); // 1 час

    await User.update(userId, {
      emailVerificationCode: verificationCode,
      emailVerificationCodeExpiresAt: expiresAt,
      lastCodeRequestAt: new Date(),
    });

    // Выводим код в console.log для разработки
    console.log(`[EMAIL VERIFICATION] User ${user.email} new verification code: ${verificationCode}`);

    res.json({ message: 'New verification code sent to console (development mode)' });
  } catch (error) {
    console.error('Request new verification code error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const requestEmailChange = async (req, res) => {
  try {
    const { newEmail } = req.body;
    const userId = req.user.id;

    if (!newEmail) {
      return res.status(400).json({ error: 'New email is required' });
    }

    // Проверяем, не используется ли email
    const existingUser = await User.findByEmail(newEmail);
    if (existingUser) {
      return res.status(400).json({ error: 'Email is already in use' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Генерируем код для нового email
    const verificationCode = generateVerificationCode();
    const expiresAt = generateExpirationDate(1); // 1 час

    await User.update(userId, {
      newEmail: newEmail,
      newEmailVerificationCode: verificationCode,
    });

    // Выводим код в console.log для разработки
    console.log(`[EMAIL CHANGE] User ${user.email} -> ${newEmail} verification code: ${verificationCode}`);

    res.json({ message: 'Verification code sent to console (development mode)' });
  } catch (error) {
    console.error('Request email change error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const confirmEmailChange = async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user.id;

    if (!code) {
      return res.status(400).json({ error: 'Verification code is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.new_email || !user.new_email_verification_code) {
      return res.status(400).json({ error: 'No email change request found' });
    }

    if (user.new_email_verification_code !== code) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    const oldEmail = user.email;

    // Обновляем email
    await User.update(userId, {
      email: user.new_email,
      newEmail: null,
      newEmailVerificationCode: null,
    });

    // Отправляем уведомление на старый email
    await sendEmailNotification(
      oldEmail,
      'Email изменен',
      `Ваш email был изменен на ${user.new_email}. Если это были не вы, пожалуйста, свяжитесь с поддержкой.`
    );

    res.json({ message: 'Email changed successfully' });
  } catch (error) {
    console.error('Confirm email change error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const updates = {};

    // Можно обновлять только определенные поля (кроме email и пароля)
    // В данном случае, кроме email и пароля других полей нет, но оставляем структуру для будущего расширения

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const updatedUser = await User.update(userId, updates);
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: updatedUser.id,
      email: updatedUser.email,
      emailVerified: updatedUser.email_verified || false,
      createdAt: updatedUser.created_at,
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Old password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const user = await User.findByEmail(req.user.email);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Проверяем старый пароль
    const saltedPassword = oldPassword + user.password_salt;
    const isValidPassword = await bcrypt.compare(saltedPassword, user.password_hash);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Invalid old password' });
    }

    // Генерируем новую соль и хешируем новый пароль
    const newPasswordSalt = User.generateSalt();
    const newSaltedPassword = newPassword + newPasswordSalt;
    const newPasswordHash = await bcrypt.hash(newSaltedPassword, 10);

    await User.update(userId, {
      passwordHash: newPasswordHash,
      passwordSalt: newPasswordSalt,
    });

    // Отправляем уведомление на email
    await sendEmailNotification(
      user.email,
      'Пароль изменен',
      'Ваш пароль был успешно изменен. Если это были не вы, пожалуйста, свяжитесь с поддержкой.'
    );

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


