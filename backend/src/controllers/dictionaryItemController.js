import DictionaryItem from '../models/DictionaryItem.js';
import Dictionary from '../models/Dictionary.js';

export const getItemsByDictionary = async (req, res) => {
  try {
    const dictionary = await Dictionary.findByName(req.params.dictionaryName);
    if (!dictionary) {
      return res.status(404).json({ error: 'Dictionary not found' });
    }
    const filters = {};
    if (req.query.name) filters.name = req.query.name;
    if (req.query.parentId !== undefined) {
      if (req.query.parentId === 'null' || req.query.parentId === '') {
        filters.parentId = null;
      } else {
        filters.parentId = parseInt(req.query.parentId);
      }
    }
    const items = await DictionaryItem.findByDictionaryId(dictionary.id, filters);
    res.json(items);
  } catch (error) {
    console.error('Get items by dictionary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getItemsByParent = async (req, res) => {
  try {
    const parentId = parseInt(req.params.parentId);
    const items = await DictionaryItem.findByParentId(parentId);
    res.json(items);
  } catch (error) {
    console.error('Get items by parent error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getItemById = async (req, res) => {
  try {
    const item = await DictionaryItem.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Dictionary item not found' });
    }

    // Проверяем, что элемент принадлежит указанному справочнику
    if (item.dictionaryId !== parseInt(req.params.dictionaryId)) {
      return res.status(404).json({ error: 'Dictionary item not found' });
    }

    res.json(item);
  } catch (error) {
    console.error('Get dictionary item error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createItem = async (req, res) => {
  try {
    const dictionary = await Dictionary.findByName(req.params.dictionaryName);
    if (!dictionary) {
      return res.status(404).json({ error: 'Dictionary not found' });
    }
    const { name, parentId } = req.body;

    const item = await DictionaryItem.create({
      dictionaryId: dictionary.id,
      name,
      parentId: parentId || null,
    });

    res.status(201).json(item);
  } catch (error) {
    console.error('Create dictionary item error:', error);
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'Item with this name already exists in this dictionary' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateItem = async (req, res) => {
  try {
    const { name, parentId } = req.body;

    const item = await DictionaryItem.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Dictionary item not found' });
    }

    const updates = {};
    if (name) updates.name = name;
    if (parentId !== undefined) updates.parentId = parentId;

    const updatedItem = await DictionaryItem.update(req.params.id, updates);
    if (!updatedItem) {
      return res.status(404).json({ error: 'Dictionary item not found' });
    }

    res.json(updatedItem);
  } catch (error) {
    console.error('Update dictionary item error:', error);
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'Item with this name already exists in this dictionary' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteItem = async (req, res) => {
  try {
    const item = await DictionaryItem.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Dictionary item not found' });
    }

    const deleted = await DictionaryItem.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Dictionary item not found' });
    }

    res.json({ message: 'Dictionary item deleted successfully' });
  } catch (error) {
    console.error('Delete dictionary item error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

