import Dictionary from '../models/Dictionary.js';

export const getAllDictionaries = async (req, res) => {
  try {
    const filters = {};
    if (req.query.state) filters.state = req.query.state;
    if (req.query.includeArchived === 'true') filters.includeArchived = true;

    const dictionaries = await Dictionary.findAll(filters);
    res.json(dictionaries);
  } catch (error) {
    console.error('Get dictionaries error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getDictionaryById = async (req, res) => {
  try {
    const dictionary = await Dictionary.findById(req.params.id);
    if (!dictionary) {
      return res.status(404).json({ error: 'Dictionary not found' });
    }
    res.json(dictionary);
  } catch (error) {
    console.error('Get dictionary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createDictionary = async (req, res) => {
  try {
    const { name, description, state } = req.body;

    const dictionary = await Dictionary.create({
      name,
      description,
      state: state || 'active',
    });

    res.status(201).json(dictionary);
  } catch (error) {
    console.error('Create dictionary error:', error);
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'Dictionary with this name already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateDictionary = async (req, res) => {
  try {
    const { name, description, state } = req.body;

    const updates = {};
    if (name) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (state) updates.state = state;

    const dictionary = await Dictionary.update(req.params.id, updates);
    if (!dictionary) {
      return res.status(404).json({ error: 'Dictionary not found' });
    }

    res.json(dictionary);
  } catch (error) {
    console.error('Update dictionary error:', error);
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'Dictionary with this name already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const archiveDictionary = async (req, res) => {
  try {
    const dictionary = await Dictionary.archive(req.params.id);
    if (!dictionary) {
      return res.status(404).json({ error: 'Dictionary not found' });
    }

    res.json({ message: 'Dictionary archived successfully', dictionary });
  } catch (error) {
    console.error('Archive dictionary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

