import pool from '../config/database.js';

class Notification {
  static async create({ userId, message }) {
    const result = await pool.query(
      `INSERT INTO notifications (user_id, message, is_read, created_at)
       VALUES ($1, $2, false, NOW())
       RETURNING *`,
      [userId, message]
    );
    return this.formatNotification(result.rows[0]);
  }

  static async findByUserId(userId, filters = {}) {
    let query = `
      SELECT *
      FROM notifications
      WHERE user_id = $1
    `;
    const params = [userId];
    let paramCount = 2;

    // Фильтр по is_read
    if (filters.isRead !== undefined) {
      query += ` AND is_read = $${paramCount}`;
      params.push(filters.isRead);
      paramCount++;
    }

    // Сортировка по дате создания (новые первыми)
    query += ' ORDER BY created_at DESC';

    // Пагинация
    const limit = parseInt(filters.limit) || 10;
    const offset = parseInt(filters.offset) || 0;
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows.map(row => this.formatNotification(row));
  }

  static async markAsRead(id, userId) {
    const result = await pool.query(
      `UPDATE notifications 
       SET is_read = true 
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId]
    );
    return result.rows[0] ? this.formatNotification(result.rows[0]) : null;
  }

  static async markAllAsRead(userId) {
    const result = await pool.query(
      `UPDATE notifications 
       SET is_read = true 
       WHERE user_id = $1 AND is_read = false
       RETURNING *`,
      [userId]
    );
    return result.rows.map(row => this.formatNotification(row));
  }

  static async getUnreadCount(userId) {
    const result = await pool.query(
      `SELECT COUNT(*) as count
       FROM notifications
       WHERE user_id = $1 AND is_read = false`,
      [userId]
    );
    return parseInt(result.rows[0].count);
  }

  static formatNotification(row) {
    if (!row) return null;
    return {
      id: row.id,
      userId: row.user_id,
      message: row.message,
      isRead: row.is_read,
      createdAt: row.created_at,
    };
  }
}

export default Notification;
