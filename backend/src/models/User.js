import pool from '../config/database.js';
import crypto from 'crypto';

class User {
  static generateSalt() {
    return crypto.randomBytes(32).toString('hex');
  }

  static async create({ email, passwordHash, passwordSalt }) {
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, password_salt, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING id, email, created_at, updated_at`,
      [email, passwordHash, passwordSalt]
    );
    return result.rows[0];
  }

  static async findByEmail(email) {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0];
  }

  static async findById(id) {
    const result = await pool.query(
      'SELECT id, email, email_verified, email_verification_code, email_verification_code_expires_at, new_email, new_email_verification_code, last_code_request_at, created_at, updated_at FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  static async update(id, updates) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (updates.email) {
      fields.push(`email = $${paramCount++}`);
      values.push(updates.email);
    }
    if (updates.passwordHash) {
      fields.push(`password_hash = $${paramCount++}`);
      values.push(updates.passwordHash);
    }
    if (updates.passwordSalt) {
      fields.push(`password_salt = $${paramCount++}`);
      values.push(updates.passwordSalt);
    }
    if (updates.emailVerified !== undefined) {
      fields.push(`email_verified = $${paramCount++}`);
      values.push(updates.emailVerified);
    }
    if (updates.emailVerificationCode !== undefined) {
      fields.push(`email_verification_code = $${paramCount++}`);
      values.push(updates.emailVerificationCode);
    }
    if (updates.emailVerificationCodeExpiresAt !== undefined) {
      fields.push(`email_verification_code_expires_at = $${paramCount++}`);
      values.push(updates.emailVerificationCodeExpiresAt);
    }
    if (updates.newEmail !== undefined) {
      fields.push(`new_email = $${paramCount++}`);
      values.push(updates.newEmail);
    }
    if (updates.newEmailVerificationCode !== undefined) {
      fields.push(`new_email_verification_code = $${paramCount++}`);
      values.push(updates.newEmailVerificationCode);
    }
    if (updates.lastCodeRequestAt !== undefined) {
      fields.push(`last_code_request_at = $${paramCount++}`);
      values.push(updates.lastCodeRequestAt);
    }

    if (fields.length === 0) return null;

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${values.length}
       RETURNING id, email, email_verified, created_at, updated_at`,
      values
    );
    return result.rows[0];
  }

  static async count() {
    const result = await pool.query(
      'SELECT COUNT(*) as total FROM users'
    );
    return parseInt(result.rows[0].total);
  }
}

export default User;

