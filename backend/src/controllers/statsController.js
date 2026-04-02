import Printer from '../models/Printer.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import Cluster from '../models/Cluster.js';

export const getStats = async (req, res) => {
  try {
    // Публичная статистика - только общие числа
    const printerCount = await Printer.count();
    const orderCount = await Order.count();
    const userCount = await User.count();
    const clusterCount = await Cluster.count();

    const stats = {
      printers: printerCount,
      orders: orderCount,
      users: userCount,
      clusters: clusterCount,
    };

    // Если пользователь авторизован, добавляем его личные счетчики
    if (req.user && req.user.id) {
      const userId = req.user.id;
      const myPrintersResult = await Printer.findAll({ userId, includeArchived: true });
      const myOrdersResult = await Order.findAll({ userId, includeArchived: true });
      const myClustersResult = await Cluster.findAll({ userId, includeArchived: true });

      stats.myPrinters = myPrintersResult.total || 0;
      stats.myOrders = myOrdersResult.total || 0;
      stats.myClusters = myClustersResult.total || 0;
    }

    res.json(stats);
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

