import ClusterPrinter from '../models/ClusterPrinter.js';
import Cluster from '../models/Cluster.js';
import Printer from '../models/Printer.js';

export const getClusterPrinters = async (req, res) => {
  try {
    const printers = await ClusterPrinter.findByClusterId(req.params.clusterId);
    res.json(printers);
  } catch (error) {
    console.error('Get cluster printers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const attachPrinter = async (req, res) => {
  try {
    const { clusterId, printerId } = req.params;

    // Проверяем существование кластера и принтера
    const cluster = await Cluster.findById(clusterId);
    if (!cluster) {
      return res.status(404).json({ error: 'Cluster not found' });
    }

    const printer = await Printer.findById(printerId);
    if (!printer) {
      return res.status(404).json({ error: 'Printer not found' });
    }

    // Проверяем права: автор кластера или владелец принтера
    if (cluster.userId !== req.user.id && printer.userId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: You must be the cluster owner or printer owner' });
    }

    // Проверяем, не привязан ли уже принтер к кластеру
    const existingAttachment = await ClusterPrinter.isAttached(clusterId, printerId);
    if (existingAttachment) {
      return res.status(400).json({ error: 'Printer is already attached to this cluster' });
    }

    const result = await ClusterPrinter.attach(clusterId, printerId, req.user.id);
    if (!result) {
      return res.status(400).json({ error: 'Printer is already attached to this cluster' });
    }

    res.status(201).json({ message: 'Printer attached successfully', attachment: result });
  } catch (error) {
    console.error('Attach printer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const detachPrinter = async (req, res) => {
  try {
    const { clusterId, printerId } = req.params;

    const result = await ClusterPrinter.detach(clusterId, printerId, req.user.id);
    if (!result) {
      return res.status(404).json({ error: 'Printer not attached or access denied' });
    }

    res.json({ message: 'Printer detached successfully' });
  } catch (error) {
    console.error('Detach printer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
