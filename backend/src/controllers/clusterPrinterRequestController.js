import ClusterPrinterRequest from '../models/ClusterPrinterRequest.js';
import Cluster from '../models/Cluster.js';

export const getClusterRequests = async (req, res) => {
  try {
    const cluster = await Cluster.findById(req.params.clusterId);
    if (!cluster) {
      return res.status(404).json({ error: 'Cluster not found' });
    }

    // Только автор кластера может видеть запросы
    if (cluster.userId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: Only cluster owner can view requests' });
    }

    const requests = await ClusterPrinterRequest.findByClusterId(req.params.clusterId);
    res.json(requests);
  } catch (error) {
    console.error('Get cluster requests error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getPrinterRequests = async (req, res) => {
  try {
    const requests = await ClusterPrinterRequest.findByPrinterId(req.params.printerId);
    res.json(requests);
  } catch (error) {
    console.error('Get printer requests error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMyRequests = async (req, res) => {
  try {
    // Запросы, где пользователь является автором кластера
    const myClusters = await Cluster.findAll({ userId: req.user.id, includeArchived: true });
    const clusterIds = myClusters.data.map(c => c.id);

    if (clusterIds.length === 0) {
      return res.json([]);
    }

    // Получаем все запросы для кластеров пользователя
    const allRequests = [];
    for (const clusterId of clusterIds) {
      const requests = await ClusterPrinterRequest.findByClusterId(clusterId);
      allRequests.push(...requests);
    }

    res.json(allRequests);
  } catch (error) {
    console.error('Get my requests error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createRequest = async (req, res) => {
  try {
    const { clusterId, printerId } = req.params;
    const { message } = req.body;

    // Проверяем существование кластера
    const cluster = await Cluster.findById(clusterId);
    if (!cluster) {
      return res.status(404).json({ error: 'Cluster not found' });
    }

    // Только автор кластера может создавать запросы
    if (cluster.userId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: Only cluster owner can create requests' });
    }

    const request = await ClusterPrinterRequest.create({
      clusterId,
      printerId,
      requestedBy: req.user.id,
      message,
    });

    if (!request) {
      return res.status(400).json({ error: 'Cannot create request: printer already attached or request already exists' });
    }

    res.status(201).json(request);
  } catch (error) {
    console.error('Create request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const approveRequest = async (req, res) => {
  try {
    const request = await ClusterPrinterRequest.approve(req.params.id, req.user.id);
    if (!request) {
      return res.status(404).json({ error: 'Request not found, already processed, or access denied' });
    }

    res.json({ message: 'Request approved successfully', request });
  } catch (error) {
    console.error('Approve request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const rejectRequest = async (req, res) => {
  try {
    const request = await ClusterPrinterRequest.reject(req.params.id, req.user.id);
    if (!request) {
      return res.status(404).json({ error: 'Request not found, already processed, or access denied' });
    }

    res.json({ message: 'Request rejected successfully', request });
  } catch (error) {
    console.error('Reject request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const cancelRequest = async (req, res) => {
  try {
    const request = await ClusterPrinterRequest.cancel(req.params.id, req.user.id);
    if (!request) {
      return res.status(404).json({ error: 'Request not found, already processed, or access denied' });
    }

    res.json({ message: 'Request cancelled successfully', request });
  } catch (error) {
    console.error('Cancel request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
