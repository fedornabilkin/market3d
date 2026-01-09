import Printer from '../models/Printer.js';

export const getAllPrinters = async (req, res) => {
  try {
    const filters = {};
    if (req.query.userId) filters.userId = parseInt(req.query.userId);
    if (req.query.clusterId) filters.clusterId = parseInt(req.query.clusterId);
    if (req.query.state) filters.state = req.query.state;
    if (req.query.page) filters.page = parseInt(req.query.page);
    if (req.query.limit) filters.limit = parseInt(req.query.limit);

    const result = await Printer.findAll(filters);
    res.json(result);
  } catch (error) {
    console.error('Get printers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getRecentPrinters = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const printers = await Printer.findRecent(limit);
    res.json(printers);
  } catch (error) {
    console.error('Get recent printers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getPrinterById = async (req, res) => {
  try {
    const printer = await Printer.findById(req.params.id);
    if (!printer) {
      return res.status(404).json({ error: 'Printer not found' });
    }
    
    // Формируем объект кластера, если принтер привязан
    const cluster = printer.clusterId ? {
      id: printer.clusterId,
      name: printer.clusterName,
    } : null;

    res.json({
      ...printer,
      cluster,
    });
  } catch (error) {
    console.error('Get printer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const savePrinter = async (req, res) => {
  try {
    const {
      modelName,
      manufacturer,
      pricePerHour,
      state,
      materialIds,
    } = req.body;

    const printerId = req.params.id;

    // Если есть ID - обновление
    if (printerId) {
      const existingPrinter = await Printer.findById(printerId);
      if (!existingPrinter) {
        return res.status(404).json({ error: 'Printer not found' });
      }

      if (existingPrinter.userId !== req.user.id) {
        return res.status(403).json({ error: 'Forbidden: You can only update your own printers' });
      }

      const updates = {};
      if (modelName) updates.modelName = modelName;
      if (manufacturer) updates.manufacturer = manufacturer;
      if (pricePerHour !== undefined) {
        if (typeof pricePerHour !== 'number' || pricePerHour < 0.01) {
          return res.status(400).json({ error: 'Price per hour must be a positive number (minimum 0.01)' });
        }
        updates.pricePerHour = parseFloat(pricePerHour);
      }
      if (state) updates.state = state;

      const updatedPrinter = await Printer.update(printerId, updates, req.user.id);
      if (!updatedPrinter) {
        return res.status(404).json({ error: 'Printer not found' });
      }

      // Обновляем материалы, если они указаны
      if (materialIds !== undefined && Array.isArray(materialIds)) {
        if (materialIds.length > 0) {
          await Printer.addMaterials(printerId, materialIds);
        } else {
          // Удаляем все материалы
          const currentMaterials = await Printer.getMaterials(printerId);
          if (currentMaterials.length > 0) {
            await Printer.removeMaterials(printerId, currentMaterials.map(m => m.id));
          }
        }
        updatedPrinter.materials = await Printer.getMaterials(printerId);
      }

      return res.json(updatedPrinter);
    } else {
      // Создание нового принтера
      const printer = await Printer.create({
        userId: req.user.id,
        modelName,
        manufacturer,
        pricePerHour: parseFloat(pricePerHour),
        state: state || 'available',
        materialIds: materialIds || [],
      });

      return res.status(201).json(printer);
    }
  } catch (error) {
    console.error('Save printer error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const addPrinterMaterials = async (req, res) => {
  try {
    const printerId = parseInt(req.params.id);
    const { materialIds } = req.body;

    if (!Array.isArray(materialIds) || materialIds.length === 0) {
      return res.status(400).json({ error: 'Material IDs must be a non-empty array' });
    }

    const printer = await Printer.findById(printerId);
    if (!printer) {
      return res.status(404).json({ error: 'Printer not found' });
    }

    if (printer.userId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: You can only modify your own printers' });
    }

    const materials = await Printer.addMaterials(printerId, materialIds);
    res.json({ materials });
  } catch (error) {
    console.error('Add printer materials error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const removePrinterMaterials = async (req, res) => {
  try {
    const printerId = parseInt(req.params.id);
    const { materialIds } = req.body;

    if (!Array.isArray(materialIds) || materialIds.length === 0) {
      return res.status(400).json({ error: 'Material IDs must be a non-empty array' });
    }

    const printer = await Printer.findById(printerId);
    if (!printer) {
      return res.status(404).json({ error: 'Printer not found' });
    }

    if (printer.userId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: You can only modify your own printers' });
    }

    const removedIds = await Printer.removeMaterials(printerId, materialIds);
    res.json({ removedIds });
  } catch (error) {
    console.error('Remove printer materials error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const archivePrinter = async (req, res) => {
  try {
    const printer = await Printer.findById(req.params.id);
    if (!printer) {
      return res.status(404).json({ error: 'Printer not found' });
    }

    if (printer.userId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: You can only archive your own printers' });
    }

    const archivedPrinter = await Printer.archive(req.params.id, req.user.id);
    if (!archivedPrinter) {
      return res.status(404).json({ error: 'Printer not found' });
    }

    res.json({ message: 'Printer archived successfully', printer: archivedPrinter });
  } catch (error) {
    console.error('Archive printer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

