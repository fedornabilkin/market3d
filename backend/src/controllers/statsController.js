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

    res.json({
      printers: printerCount,
      orders: orderCount,
      users: userCount,
      clusters: clusterCount,
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

