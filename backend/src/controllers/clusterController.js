import Cluster from '../models/Cluster.js';

export const getAllClusters = async (req, res) => {
  try {
    const filters = {};
    if (req.query.userId) filters.userId = parseInt(req.query.userId);
    if (req.query.state) filters.state = req.query.state;
    if (req.query.regionId) filters.regionId = parseInt(req.query.regionId);
    if (req.query.cityId) filters.cityId = parseInt(req.query.cityId);
    if (req.query.materialId) filters.materialId = parseInt(req.query.materialId);
    if (req.query.colorId) filters.colorId = parseInt(req.query.colorId);
    if (req.query.page) filters.page = parseInt(req.query.page);
    if (req.query.limit) filters.limit = parseInt(req.query.limit);
    if (req.query.includeArchived === 'true') filters.includeArchived = true;

    const result = await Cluster.findAll(filters);
    res.json(result);
  } catch (error) {
    console.error('Get clusters error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMyClusters = async (req, res) => {
  try {
    const filters = {};
    filters.userId = req.user.id;
    if (req.query.state) filters.state = req.query.state;
    if (req.query.regionId) filters.regionId = parseInt(req.query.regionId);
    if (req.query.cityId) filters.cityId = parseInt(req.query.cityId);
    if (req.query.materialId) filters.materialId = parseInt(req.query.materialId);
    if (req.query.colorId) filters.colorId = parseInt(req.query.colorId);
    if (req.query.page) filters.page = parseInt(req.query.page);
    if (req.query.limit) filters.limit = parseInt(req.query.limit);
    if (req.query.includeArchived === 'true') filters.includeArchived = true;

    const result = await Cluster.findAll(filters);
    res.json(result);
  } catch (error) {
    console.error('Get clusters error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export const getActiveClusters = async (req, res) => {
  try {
    const clusters = await Cluster.findActive();
    res.json(clusters);
  } catch (error) {
    console.error('Get active clusters error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getClusterById = async (req, res) => {
  try {
    const cluster = await Cluster.findById(req.params.id);
    if (!cluster) {
      return res.status(404).json({ error: 'Cluster not found' });
    }

    // Дополнительные данные уже включены в findById
    const availablePrintersCount = await Cluster.getAvailablePrintersCount(cluster.id);
    
    res.json({
      ...cluster,
      availablePrintersCount,
    });
  } catch (error) {
    console.error('Get cluster error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createCluster = async (req, res) => {
  try {
    const {
      name,
      description,
      regionId,
      cityId,
      metroId,
      parentClusterId,
      deliveryMethodIds,
    } = req.body;

    const cluster = await Cluster.create({
      userId: req.user.id,
      name,
      description,
      regionId,
      cityId,
      metroId,
      parentClusterId,
      state: 'draft',
      deliveryMethodIds: deliveryMethodIds || [],
    });

    res.status(201).json(cluster);
  } catch (error) {
    console.error('Create cluster error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const updateCluster = async (req, res) => {
  try {
    const {
      name,
      description,
      regionId,
      cityId,
      metroId,
      parentClusterId,
      deliveryMethodIds,
    } = req.body;

    const updates = {};
    if (name) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (regionId !== undefined) updates.regionId = regionId;
    if (cityId !== undefined) updates.cityId = cityId;
    if (metroId !== undefined) updates.metroId = metroId;
    if (parentClusterId !== undefined) updates.parentClusterId = parentClusterId;

    const updatedCluster = await Cluster.update(req.params.id, updates, req.user.id);
    if (!updatedCluster) {
      return res.status(404).json({ error: 'Cluster not found or access denied' });
    }

    // Обновляем способы доставки, если они указаны
    if (deliveryMethodIds !== undefined && Array.isArray(deliveryMethodIds)) {
      if (deliveryMethodIds.length > 0) {
        await Cluster.addDeliveryMethods(req.params.id, deliveryMethodIds);
      } else {
        // Удаляем все способы доставки
        const currentDeliveryMethods = await Cluster.getDeliveryMethods(req.params.id);
        if (currentDeliveryMethods.length > 0) {
          await Cluster.removeDeliveryMethods(req.params.id, currentDeliveryMethods.map(d => d.id));
        }
      }
      updatedCluster.deliveryMethods = await Cluster.getDeliveryMethods(req.params.id);
    }

    res.json(updatedCluster);
  } catch (error) {
    console.error('Update cluster error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const activateCluster = async (req, res) => {
  try {
    const cluster = await Cluster.activate(req.params.id, req.user.id);
    if (!cluster) {
      return res.status(400).json({ error: 'Cannot activate cluster: must have at least one printer or access denied' });
    }

    res.json(cluster);
  } catch (error) {
    console.error('Activate cluster error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const archiveCluster = async (req, res) => {
  try {
    const cluster = await Cluster.archive(req.params.id, req.user.id);
    if (!cluster) {
      return res.status(404).json({ error: 'Cluster not found or access denied' });
    }

    res.json({ message: 'Cluster archived successfully', cluster });
  } catch (error) {
    console.error('Archive cluster error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
