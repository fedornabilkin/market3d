import pool from '../config/database.js';

class OrderMessage {
  static async create({ orderId, senderId, message }) {
    // Проверяем, что заказ существует и не в статусе draft
    const orderCheck = await pool.query(
      `SELECT o.id, o.user_id, o.state,
              oc.cluster_id, c.user_id as cluster_owner_id
       FROM orders o
       LEFT JOIN order_clusters oc ON o.id = oc.order_id
       LEFT JOIN clusters c ON oc.cluster_id = c.id
       WHERE o.id = $1`,
      [orderId]
    );

    if (orderCheck.rows.length === 0) {
      throw new Error('Order not found');
    }

    const order = orderCheck.rows[0];

    // Нельзя отправлять сообщения для заказов в статусе draft
    if (order.state === 'draft') {
      throw new Error('Cannot send messages for draft orders');
    }

    // Проверяем права: только автор заказа или автор кластера могут отправлять сообщения
    const isOrderAuthor = order.user_id === senderId;
    const isClusterOwner = order.cluster_owner_id === senderId;

    if (!isOrderAuthor && !isClusterOwner) {
      throw new Error('Only order author or cluster owner can send messages');
    }

    const result = await pool.query(
      `INSERT INTO order_messages (order_id, sender_id, message, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      [orderId, senderId, message]
    );
    return this.formatMessage(result.rows[0]);
  }

  static async findByOrderId(orderId) {
    const result = await pool.query(
      `SELECT m.*, u.email as sender_email, u.role as sender_role
       FROM order_messages m
       LEFT JOIN users u ON m.sender_id = u.id
       WHERE m.order_id = $1
       ORDER BY m.created_at ASC`,
      [orderId]
    );
    return result.rows.map(row => this.formatMessage(row));
  }

  static formatMessage(row) {
    if (!row) return null;
    return {
      id: row.id,
      orderId: row.order_id,
      senderId: row.sender_id,
      senderEmail: row.sender_email,
      senderRole: row.sender_role,
      message: row.message,
      createdAt: row.created_at,
    };
  }
}

export default OrderMessage;

