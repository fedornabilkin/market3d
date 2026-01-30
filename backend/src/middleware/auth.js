import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import dotenv from 'dotenv';

dotenv.config();

// Local Strategy
passport.use(
  new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password',
    },
    async (email, password, done) => {
      try {
        const user = await User.findByEmail(email);
        if (!user) {
          return done(null, false, { message: 'Invalid email or password' });
        }

        // Используем соль для проверки пароля
        const saltedPassword = password + user.password_salt;
        const isValidPassword = await bcrypt.compare(saltedPassword, user.password_hash);
        if (!isValidPassword) {
          return done(null, false, { message: 'Invalid email or password' });
        }

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

// JWT Strategy
passport.use(
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET || 'your-secret-key',
    },
    async (payload, done) => {
      try {
        const user = await User.findById(payload.id);
        if (!user) {
          return done(null, false);
        }
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

// Generate JWT token
export const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Middleware для проверки JWT
export const authenticateJWT = passport.authenticate('jwt', { session: false });

// Middleware для обновления времени последней активности пользователя
export const updateLastActivity = async (req, res, next) => {
  if (req.user && req.user.id) {
    try {
      // Обновляем время активности асинхронно, не блокируя запрос
      User.updateLastActivity(req.user.id).catch(err => {
        console.error('Failed to update last activity:', err);
      });
    } catch (error) {
      // Не прерываем запрос при ошибке обновления активности
      console.error('Error in updateLastActivity middleware:', error);
    }
  }
  next();
};

export default passport;

