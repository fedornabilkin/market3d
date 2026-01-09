import Address from '../models/Address.js';

export const getUserAddresses = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    // Проверяем права доступа
    if (userId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: You can only view your own addresses' });
    }

    const addresses = await Address.findByUserId(userId);
    res.json(addresses);
  } catch (error) {
    console.error('Get user addresses error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getPrinterAddresses = async (req, res) => {
  try {
    const printerId = parseInt(req.params.printerId);
    const addresses = await Address.findByPrinterId(printerId);
    res.json(addresses);
  } catch (error) {
    console.error('Get printer addresses error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createAddress = async (req, res) => {
  try {
    const {
      userId,
      printerId,
      addressLine,
      city,
      region,
      country,
      postalCode,
      latitude,
      longitude,
      isPrimary,
    } = req.body;

    // Проверяем права доступа для адресов пользователя
    if (userId && userId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: You can only create addresses for yourself' });
    }

    const address = await Address.create({
      userId: userId || null,
      printerId: printerId || null,
      addressLine,
      city,
      region,
      country,
      postalCode,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      isPrimary: isPrimary || false,
    });

    res.status(201).json(address);
  } catch (error) {
    console.error('Create address error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateAddress = async (req, res) => {
  try {
    const addressId = parseInt(req.params.id);
    const address = await Address.findById(addressId);
    
    if (!address) {
      return res.status(404).json({ error: 'Address not found' });
    }

    // Проверяем права доступа
    if (address.userId && address.userId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: You can only update your own addresses' });
    }

    const updates = {};
    if (req.body.addressLine) updates.addressLine = req.body.addressLine;
    if (req.body.city !== undefined) updates.city = req.body.city;
    if (req.body.region !== undefined) updates.region = req.body.region;
    if (req.body.country !== undefined) updates.country = req.body.country;
    if (req.body.postalCode !== undefined) updates.postalCode = req.body.postalCode;
    if (req.body.latitude !== undefined) updates.latitude = parseFloat(req.body.latitude);
    if (req.body.longitude !== undefined) updates.longitude = parseFloat(req.body.longitude);
    if (req.body.isPrimary !== undefined) updates.isPrimary = req.body.isPrimary;

    const updatedAddress = await Address.update(addressId, updates);
    if (!updatedAddress) {
      return res.status(404).json({ error: 'Address not found' });
    }

    res.json(updatedAddress);
  } catch (error) {
    console.error('Update address error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteAddress = async (req, res) => {
  try {
    const addressId = parseInt(req.params.id);
    const address = await Address.findById(addressId);
    
    if (!address) {
      return res.status(404).json({ error: 'Address not found' });
    }

    // Проверяем права доступа
    if (address.userId && address.userId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: You can only delete your own addresses' });
    }

    const deleted = await Address.delete(addressId);
    if (!deleted) {
      return res.status(404).json({ error: 'Address not found' });
    }

    res.json({ message: 'Address deleted successfully' });
  } catch (error) {
    console.error('Delete address error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

