import Printer from '../models/Printer.js';

export const getAllPrinters = async (req, res) => {
  try {
    const filters = {};
    // По умолчанию показываем только принтеры текущего пользователя
    filters.userId = req.user.id;
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

    // Скрываем описание для неавторов
    const isAuthor = req.user && printer.userId === req.user.id;
    const response = {
      ...printer,
      cluster,
    };
    
    if (!isAuthor) {
      delete response.description;
    }

    res.json(response);
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
      colorIds,
      maxSizeX,
      maxSizeY,
      maxSizeZ,
      description,
      quantity,
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
        if (typeof pricePerHour !== 'number' || pricePerHour < 1 || !Number.isInteger(pricePerHour)) {
          return res.status(400).json({ error: 'Price per hour must be a positive integer (minimum 1)' });
        }
        updates.pricePerHour = parseInt(pricePerHour);
      }
      if (state) updates.state = state;
      if (maxSizeX !== undefined) updates.maxSizeX = parseFloat(maxSizeX);
      if (maxSizeY !== undefined) updates.maxSizeY = parseFloat(maxSizeY);
      if (maxSizeZ !== undefined) updates.maxSizeZ = parseFloat(maxSizeZ);
      if (description !== undefined) updates.description = description;
      if (quantity !== undefined) updates.quantity = parseInt(quantity);

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

      // Обновляем цвета, если они указаны
      if (colorIds !== undefined && Array.isArray(colorIds)) {
        if (colorIds.length > 0) {
          await Printer.addColors(printerId, colorIds);
        } else {
          // Удаляем все цвета
          const currentColors = await Printer.getColors(printerId);
          if (currentColors.length > 0) {
            await Printer.removeColors(printerId, currentColors.map(c => c.id));
          }
        }
        updatedPrinter.colors = await Printer.getColors(printerId);
      }

      return res.json(updatedPrinter);
    } else {
      // Создание нового принтера
      const printer = await Printer.create({
        userId: req.user.id,
        modelName,
        manufacturer,
        pricePerHour: parseInt(pricePerHour),
        state: state || 'available',
        materialIds: materialIds || [],
        colorIds: colorIds || [],
        maxSizeX: parseFloat(maxSizeX),
        maxSizeY: parseFloat(maxSizeY),
        maxSizeZ: parseFloat(maxSizeZ),
        description: description || null,
        quantity: quantity || 1,
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

export const addPrinterColors = async (req, res) => {
  try {
    const printerId = parseInt(req.params.id);
    const { colorIds } = req.body;

    if (!Array.isArray(colorIds) || colorIds.length === 0) {
      return res.status(400).json({ error: 'Color IDs must be a non-empty array' });
    }

    const printer = await Printer.findById(printerId);
    if (!printer) {
      return res.status(404).json({ error: 'Printer not found' });
    }

    if (printer.userId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: You can only modify your own printers' });
    }

    const colors = await Printer.addColors(printerId, colorIds);
    res.json({ colors });
  } catch (error) {
    console.error('Add printer colors error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const removePrinterColors = async (req, res) => {
  try {
    const printerId = parseInt(req.params.id);
    const { colorIds } = req.body;

    if (!Array.isArray(colorIds) || colorIds.length === 0) {
      return res.status(400).json({ error: 'Color IDs must be a non-empty array' });
    }

    const printer = await Printer.findById(printerId);
    if (!printer) {
      return res.status(404).json({ error: 'Printer not found' });
    }

    if (printer.userId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: You can only modify your own printers' });
    }

    const removedIds = await Printer.removeColors(printerId, colorIds);
    res.json({ removedIds });
  } catch (error) {
    console.error('Remove printer colors error:', error);
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

