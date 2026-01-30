import pool from '../config/database.js';

class Order {
  static async create({ userId, material, colorId, quantity, dimensions, deadline, totalPrice, description, deliveryMethodId }) {
    const result = await pool.query(
      `INSERT INTO orders (user_id, material, color_id, quantity, dimensions, deadline, state, total_price, description, delivery_method_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7, $8, $9, NOW(), NOW())
       RETURNING *`,
      [userId, material || null, colorId || null, quantity, JSON.stringify(dimensions || {}), deadline, totalPrice || 0, description || '', deliveryMethodId || null]
    );
    return this.formatOrder(result.rows[0]);
  }

  static async createWithCluster({ userId, material, colorId, quantity, dimensions, deadline, totalPrice, description, deliveryMethodId }, clusterId) {
    // Проверяем существование кластера
    const clusterCheck = await pool.query('SELECT id, user_id FROM clusters WHERE id = $1', [clusterId]);
    if (clusterCheck.rows.length === 0) {
      throw new Error('Cluster not found');
    }

    // Проверяем, что это не мой кластер
    if (clusterCheck.rows[0].user_id === userId) {
      throw new Error('Cannot create order for your own cluster');
    }

    // Создаем заказ
    const order = await this.create({ userId, material, colorId, quantity, dimensions, deadline, totalPrice, description, deliveryMethodId });

    // Привязываем заказ к кластеру
    await pool.query(
      `INSERT INTO order_clusters (order_id, cluster_id, created_at)
       VALUES ($1, $2, NOW())`,
      [order.id, clusterId]
    );

    // Загружаем информацию о кластере
    order.clusterId = clusterId;
    const clusterInfo = await pool.query(
      `SELECT c.id, c.name, c.user_id, u.email as owner_email
       FROM clusters c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.id = $1`,
      [clusterId]
    );
    if (clusterInfo.rows[0]) {
      order.clusterName = clusterInfo.rows[0].name;
      order.clusterOwnerId = clusterInfo.rows[0].user_id;
      order.clusterOwnerEmail = clusterInfo.rows[0].owner_email;
    }

    return order;
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT o.*, 
             u.email as user_email,
             di_color.id as color_id,
             di_color.name as color_name
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN dictionary_items di_color ON o.color_id = di_color.id
      WHERE 1=1
    `;
    let countQuery = `
      SELECT COUNT(*) as total
      FROM orders o
      WHERE 1=1
    `;
    const params = [];
    const countParams = [];
    let paramCount = 1;

    // Исключаем архивные заказы по умолчанию
    if (filters.includeArchived !== true) {
      query += ` AND o.state != 'archived'`;
      countQuery += ` AND o.state != 'archived'`;
    }

    if (filters.userId) {
      query += ` AND o.user_id = $${paramCount}`;
      countQuery += ` AND o.user_id = $${paramCount}`;
      params.push(filters.userId);
      countParams.push(filters.userId);
      paramCount++;
    }
    if (filters.state) {
      query += ` AND o.state = $${paramCount}`;
      countQuery += ` AND o.state = $${paramCount}`;
      params.push(filters.state);
      countParams.push(filters.state);
      paramCount++;
    }

    // Пагинация
    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 20;
    const offset = (page - 1) * limit;

    // Сортировка по id в обратном порядке
    query += ' ORDER BY o.id DESC';
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const [result, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, countParams),
    ]);

    const total = parseInt(countResult.rows[0].total);
    const pages = Math.ceil(total / limit);

    return {
      data: result.rows.map(row => this.formatOrder(row)),
      total,
      page,
      limit,
      pages,
    };
  }

  static async findRecent(limit = 5) {
    const result = await pool.query(
      `SELECT o.*, 
              u.email as user_email
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       WHERE o.state != 'archived'
       ORDER BY o.created_at DESC 
       LIMIT $1`,
      [limit]
    );
    return result.rows.map(row => this.formatOrder(row));
  }

  static async count() {
    const result = await pool.query(
      'SELECT COUNT(*) as total FROM orders WHERE state != \'archived\''
    );
    return parseInt(result.rows[0].total);
  }

  static async findById(id) {
    const result = await pool.query(
      `SELECT o.*, 
              u.email as user_email,
              di_color.id as color_id,
              di_color.name as color_name,
              di_delivery.id as delivery_method_id,
              di_delivery.name as delivery_method_name
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       LEFT JOIN dictionary_items di_color ON o.color_id = di_color.id
       LEFT JOIN dictionary_items di_delivery ON o.delivery_method_id = di_delivery.id
       WHERE o.id = $1`,
      [id]
    );
    if (!result.rows[0]) return null;
    
    const order = this.formatOrder(result.rows[0]);
    
    // Загружаем информацию о кластере, если заказ привязан к кластеру
    const clusterResult = await pool.query(
      `SELECT c.id, c.name, c.user_id, u.email as owner_email
       FROM order_clusters oc
       INNER JOIN clusters c ON oc.cluster_id = c.id
       LEFT JOIN users u ON c.user_id = u.id
       WHERE oc.order_id = $1
       LIMIT 1`,
      [id]
    );
    
    if (clusterResult.rows[0]) {
      order.clusterId = clusterResult.rows[0].id;
      order.clusterName = clusterResult.rows[0].name;
      order.clusterOwnerId = clusterResult.rows[0].user_id;
      order.clusterOwnerEmail = clusterResult.rows[0].owner_email;
    }
    
    return order;
  }

  static async update(id, updates, userId) {
    // Проверяем права доступа
    const order = await this.findById(id);
    if (!order) return null;

    // Только владелец заказа может редактировать черновик
    if (order.state === 'draft' && order.userId !== userId) {
      return null;
    }

    // Только владелец заказа может редактировать
    if (order.userId !== userId) {
      return null;
    }

    const fields = [];
    const values = [];
    let paramCount = 1;

    if (updates.material !== undefined) {
      fields.push(`material = $${paramCount++}`);
      values.push(updates.material || null);
    }
    if (updates.colorId !== undefined) {
      fields.push(`color_id = $${paramCount++}`);
      values.push(updates.colorId);
    }
    if (updates.quantity !== undefined) {
      fields.push(`quantity = $${paramCount++}`);
      values.push(updates.quantity);
    }
    if (updates.dimensions) {
      fields.push(`dimensions = $${paramCount++}`);
      values.push(JSON.stringify(updates.dimensions));
    }
    if (updates.deadline) {
      fields.push(`deadline = $${paramCount++}`);
      values.push(updates.deadline);
    }
    if (updates.totalPrice !== undefined) {
      fields.push(`total_price = $${paramCount++}`);
      values.push(updates.totalPrice);
    }
    if (updates.description !== undefined) {
      fields.push(`description = $${paramCount++}`);
      values.push(updates.description);
    }
    if (updates.deliveryMethodId !== undefined) {
      fields.push(`delivery_method_id = $${paramCount++}`);
      values.push(updates.deliveryMethodId);
    }

    if (fields.length === 0) return order;

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE orders SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
    return result.rows[0] ? this.formatOrder(result.rows[0]) : null;
  }

  static async updateState(id, state, userId) {
    // Проверяем права доступа
    const order = await this.findById(id);
    if (!order) return null;

    // Только владелец заказа может изменять состояние
    if (order.userId !== userId) {
      return null;
    }

    // Если переходим в статус completed, устанавливаем completed_at
    const updates = state === 'completed' 
      ? `state = $1, completed_at = NOW(), updated_at = NOW()`
      : `state = $1, updated_at = NOW()`;

    const result = await pool.query(
      `UPDATE orders SET ${updates} WHERE id = $2 RETURNING *`,
      [state, id]
    );
    
    const updatedOrder = result.rows[0] ? this.formatOrder(result.rows[0]) : null;
    
    // Если заказ обновлен и привязан к кластеру, возвращаем информацию о кластере для создания уведомления
    if (updatedOrder && order.clusterOwnerId) {
      updatedOrder.clusterOwnerId = order.clusterOwnerId;
    }
    
    return updatedOrder;
  }

  static async archive(id, userId) {
    // Проверяем права доступа
    const order = await this.findById(id);
    if (!order) return null;

    // Только владелец заказа может архивировать
    if (order.userId !== userId) {
      return null;
    }

    const result = await pool.query(
      `UPDATE orders SET state = 'archived', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0] ? this.formatOrder(result.rows[0]) : null;
  }

  static async submitDraft(id, userId) {
    // Проверяем, что заказ в состоянии draft и принадлежит пользователю
    const order = await this.findById(id);
    if (!order || order.state !== 'draft' || order.userId !== userId) {
      return null;
    }

    // Меняем состояние на pending
    const result = await pool.query(
      `UPDATE orders SET state = 'pending', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0] ? this.formatOrder(result.rows[0]) : null;
  }

  static formatOrder(row) {
    if (!row) return null;
    const order = {
      id: row.id,
      userId: row.user_id,
      userEmail: row.user_email,
      modelFileUrl: row.model_file_url, // Deprecated, use order_files table
      material: row.material,
      color: row.color, // Оставляем для обратной совместимости
      colorId: row.color_id,
      colorName: row.color_name,
      quantity: row.quantity,
      dimensions: typeof row.dimensions === 'string' ? JSON.parse(row.dimensions) : row.dimensions,
      deadline: row.deadline,
      state: row.state,
      totalPrice: parseFloat(row.total_price),
      description: row.description || '',
      deliveryMethodId: row.delivery_method_id,
      deliveryMethodName: row.delivery_method_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
    };
    
    // Добавляем информацию о кластере, если она есть
    if (row.cluster_id !== undefined) {
      order.clusterId = row.cluster_id;
      order.clusterName = row.cluster_name;
      order.clusterOwnerId = row.cluster_owner_id;
      order.clusterOwnerEmail = row.cluster_owner_email;
    }
    
    return order;
  }
}

export default Order;

