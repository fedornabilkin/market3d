import Order from '../models/Order.js';
import OrderFile from '../models/OrderFile.js';

export const getAllOrders = async (req, res) => {
  try {
    const filters = {};
    
    // Фильтруем по пользователю, если не указан другой фильтр
    if (req.query.userId) {
      filters.userId = parseInt(req.query.userId);
    } else {
      // По умолчанию показываем заказы текущего пользователя
      filters.userId = req.user.id;
    }

    if (req.query.state) filters.state = req.query.state;
    if (req.query.page) filters.page = parseInt(req.query.page);
    if (req.query.limit) filters.limit = parseInt(req.query.limit);

    const result = await Order.findAll(filters);
    res.json(result);
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getRecentOrders = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const orders = await Order.findRecent(limit);
    res.json(orders);
  } catch (error) {
    console.error('Get recent orders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Проверяем права доступа - автор заказа или автор кластера могут просматривать
    const isOrderAuthor = order.userId === req.user.id;
    const isClusterOwner = order.clusterOwnerId === req.user.id;
    
    if (!isOrderAuthor && !isClusterOwner) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Получаем файлы заказа
    const files = await OrderFile.findByOrderId(req.params.id);

    res.json({
      ...order,
      files,
    });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const saveOrder = async (req, res) => {
  try {
    const {
      material,
      color,
      quantity,
      deadline,
      description,
    } = req.body;

    const orderId = req.params.id;

    // Если есть ID - обновление
    if (orderId) {
      const existingOrder = await Order.findById(orderId);
      if (!existingOrder) {
        return res.status(404).json({ error: 'Order not found' });
      }

      if (existingOrder.userId !== req.user.id) {
        return res.status(403).json({ error: 'Forbidden: You can only update your own orders' });
      }

      // Можно обновлять только черновики
      if (existingOrder.state !== 'draft') {
        return res.status(400).json({ error: 'Only draft orders can be updated' });
      }

      const updates = {};
      if (material) updates.material = material;
      if (color !== undefined) updates.color = color;
      if (quantity !== undefined) updates.quantity = parseInt(quantity);
      if (deadline) updates.deadline = deadline;
      if (description !== undefined) updates.description = description;

      const updatedOrder = await Order.update(orderId, updates, req.user.id);
      if (!updatedOrder) {
        return res.status(404).json({ error: 'Order not found or access denied' });
      }

      return res.json(updatedOrder);
    } else {
      // Создание нового заказа
      const { clusterId } = req.body;
      
      let order;
      if (clusterId) {
        // Создание заказа с привязкой к кластеру
        order = await Order.createWithCluster({
          userId: req.user.id,
          material,
          color: color || 'default',
          quantity: parseInt(quantity),
          dimensions: {},
          deadline,
          totalPrice: 0,
          description: description || '',
        }, clusterId);
      } else {
        // Обычное создание заказа
        order = await Order.create({
          userId: req.user.id,
          material,
          color: color || 'default',
          quantity: parseInt(quantity),
          dimensions: {},
          deadline,
          totalPrice: 0,
          description: description || '',
        });
      }

      return res.status(201).json(order);
    }
  } catch (error) {
    console.error('Save order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const archiveOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.userId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: You can only archive your own orders' });
    }

    const archivedOrder = await Order.archive(req.params.id, req.user.id);
    if (!archivedOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ message: 'Order archived successfully', order: archivedOrder });
  } catch (error) {
    console.error('Archive order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const submitOrder = async (req, res) => {
  try {
    const order = await Order.submitDraft(req.params.id, req.user.id);

    if (!order) {
      return res.status(404).json({ error: 'Order not found, not a draft, or access denied' });
    }

    res.json(order);
  } catch (error) {
    console.error('Submit order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateOrderState = async (req, res) => {
  try {
    const { state } = req.body;
    const validStates = ['draft', 'pending', 'approved', 'in_progress', 'completed', 'cancelled'];
    
    if (!validStates.includes(state)) {
      return res.status(400).json({ error: 'Invalid state' });
    }

    const order = await Order.updateState(
      req.params.id,
      state,
      req.user.id
    );

    if (!order) {
      return res.status(404).json({ error: 'Order not found or access denied' });
    }

    res.json(order);
  } catch (error) {
    console.error('Update order state error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getClusterOrders = async (req, res) => {
  try {
    const clusterId = parseInt(req.params.clusterId);
    
    // Проверяем существование кластера
    const clusterCheck = await pool.query('SELECT id, user_id FROM clusters WHERE id = $1', [clusterId]);
    if (clusterCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Cluster not found' });
    }

    // Проверяем права: только автор кластера может видеть заказы
    if (clusterCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: Only cluster owner can view orders' });
    }

    // Получаем заказы кластера
    const result = await pool.query(
      `SELECT o.*, 
              u.email as user_email,
              oc.cluster_id
       FROM orders o
       INNER JOIN order_clusters oc ON o.id = oc.order_id
       LEFT JOIN users u ON o.user_id = u.id
       WHERE oc.cluster_id = $1
       ORDER BY o.created_at DESC`,
      [clusterId]
    );

    const orders = result.rows.map(row => Order.formatOrder(row));
    res.json(orders);
  } catch (error) {
    console.error('Get cluster orders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
