import OrderMessage from '../models/OrderMessage.js';
import Order from '../models/Order.js';

export const getOrderMessages = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Проверяем права доступа - автор заказа или автор кластера могут просматривать сообщения
    const isOrderAuthor = order.userId === req.user.id;
    const isClusterOwner = order.clusterOwnerId === req.user.id;
    
    if (!isOrderAuthor && !isClusterOwner) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Нельзя просматривать сообщения для заказов в статусе draft
    if (order.state === 'draft') {
      return res.status(400).json({ error: 'Cannot view messages for draft orders' });
    }

    const messages = await OrderMessage.findByOrderId(req.params.orderId);
    res.json(messages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const createMessage = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const newMessage = await OrderMessage.create({
      orderId: req.params.orderId,
      senderId: req.user.id,
      message: message.trim(),
    });

    res.status(201).json(newMessage);
  } catch (error) {
    console.error('Create message error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

