import pool from '../config/database.js';

class OrderFile {
  static async create({ orderId, fileUrl, fileName, fileSize, fileType }) {
    const result = await pool.query(
      `INSERT INTO order_files (order_id, file_url, file_name, file_size, file_type, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [orderId, fileUrl, fileName, fileSize, fileType]
    );
    return this.formatFile(result.rows[0]);
  }

  static async findByOrderId(orderId) {
    const result = await pool.query(
      'SELECT * FROM order_files WHERE order_id = $1 ORDER BY created_at ASC',
      [orderId]
    );
    return result.rows.map(row => this.formatFile(row));
  }

  static async findById(id) {
    const result = await pool.query('SELECT * FROM order_files WHERE id = $1', [id]);
    return result.rows[0] ? this.formatFile(result.rows[0]) : null;
  }

  static async delete(id, orderId) {
    const result = await pool.query(
      'DELETE FROM order_files WHERE id = $1 AND order_id = $2 RETURNING id',
      [id, orderId]
    );
    return result.rows[0] !== undefined;
  }

  static formatFile(row) {
    if (!row) return null;
    return {
      id: row.id,
      orderId: row.order_id,
      fileUrl: row.file_url,
      fileName: row.file_name,
      fileSize: row.file_size,
      fileType: row.file_type,
      createdAt: row.created_at,
    };
  }
}

export default OrderFile;

