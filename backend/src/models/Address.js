import pool from '../config/database.js';

class Address {
  static async create({ userId, printerId, addressLine, city, region, country, postalCode, latitude, longitude, isPrimary }) {
    const result = await pool.query(
      `INSERT INTO addresses (user_id, printer_id, address_line, city, region, country, postal_code, latitude, longitude, is_primary, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
       RETURNING *`,
      [userId || null, printerId || null, addressLine, city, region, country, postalCode, latitude, longitude, isPrimary || false]
    );
    return this.formatAddress(result.rows[0]);
  }

  static async findByUserId(userId) {
    const result = await pool.query(
      'SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_primary DESC, created_at DESC',
      [userId]
    );
    return result.rows.map(row => this.formatAddress(row));
  }

  static async findByPrinterId(printerId) {
    const result = await pool.query(
      'SELECT * FROM addresses WHERE printer_id = $1 ORDER BY is_primary DESC, created_at DESC',
      [printerId]
    );
    return result.rows.map(row => this.formatAddress(row));
  }

  static async findPrimaryByUserId(userId) {
    const result = await pool.query(
      'SELECT * FROM addresses WHERE user_id = $1 AND is_primary = true LIMIT 1',
      [userId]
    );
    return result.rows[0] ? this.formatAddress(result.rows[0]) : null;
  }

  static async findPrimaryByPrinterId(printerId) {
    const result = await pool.query(
      'SELECT * FROM addresses WHERE printer_id = $1 AND is_primary = true LIMIT 1',
      [printerId]
    );
    return result.rows[0] ? this.formatAddress(result.rows[0]) : null;
  }

  static async update(id, updates) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (updates.addressLine !== undefined) {
      fields.push(`address_line = $${paramCount++}`);
      values.push(updates.addressLine);
    }
    if (updates.city !== undefined) {
      fields.push(`city = $${paramCount++}`);
      values.push(updates.city);
    }
    if (updates.region !== undefined) {
      fields.push(`region = $${paramCount++}`);
      values.push(updates.region);
    }
    if (updates.country !== undefined) {
      fields.push(`country = $${paramCount++}`);
      values.push(updates.country);
    }
    if (updates.postalCode !== undefined) {
      fields.push(`postal_code = $${paramCount++}`);
      values.push(updates.postalCode);
    }
    if (updates.latitude !== undefined) {
      fields.push(`latitude = $${paramCount++}`);
      values.push(updates.latitude);
    }
    if (updates.longitude !== undefined) {
      fields.push(`longitude = $${paramCount++}`);
      values.push(updates.longitude);
    }
    if (updates.isPrimary !== undefined) {
      fields.push(`is_primary = $${paramCount++}`);
      values.push(updates.isPrimary);
    }

    if (fields.length === 0) return null;

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE addresses SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
    return result.rows[0] ? this.formatAddress(result.rows[0]) : null;
  }

  static async findById(id) {
    const result = await pool.query('SELECT * FROM addresses WHERE id = $1', [id]);
    return result.rows[0] ? this.formatAddress(result.rows[0]) : null;
  }

  static async delete(id) {
    const result = await pool.query(
      'DELETE FROM addresses WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rows[0] !== undefined;
  }

  static formatAddress(row) {
    if (!row) return null;
    return {
      id: row.id,
      userId: row.user_id,
      printerId: row.printer_id,
      addressLine: row.address_line,
      city: row.city,
      region: row.region,
      country: row.country,
      postalCode: row.postal_code,
      latitude: row.latitude ? parseFloat(row.latitude) : null,
      longitude: row.longitude ? parseFloat(row.longitude) : null,
      isPrimary: row.is_primary,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export default Address;

