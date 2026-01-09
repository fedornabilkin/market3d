import pool from '../config/database.js';

class DictionaryItem {
  static async findByDictionaryId(dictionaryId, filters = {}) {
    let query = 'SELECT * FROM dictionary_items WHERE dictionary_id = $1';
    const params = [dictionaryId];
    let paramCount = 2;

    if (filters.name) {
      query += ` AND name ILIKE $${paramCount++}`;
      params.push(`%${filters.name}%`);
    }

    if (filters.parentId !== undefined) {
      if (filters.parentId === null) {
        query += ` AND parent_id IS NULL`;
      } else {
        query += ` AND parent_id = $${paramCount++}`;
        params.push(filters.parentId);
      }
    }

    query += ' ORDER BY name ASC';

    const result = await pool.query(query, params);
    return result.rows.map(row => this.formatItem(row));
  }

  static async findByParentId(parentId) {
    const result = await pool.query(
      'SELECT * FROM dictionary_items WHERE parent_id = $1 ORDER BY name ASC',
      [parentId]
    );
    return result.rows.map(row => this.formatItem(row));
  }

  static async findById(id) {
    const result = await pool.query(
      'SELECT * FROM dictionary_items WHERE id = $1',
      [id]
    );
    return result.rows[0] ? this.formatItem(result.rows[0]) : null;
  }

  static async create({ dictionaryId, name }) {
    const result = await pool.query(
      `INSERT INTO dictionary_items (dictionary_id, name, created_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())
       RETURNING *`,
      [dictionaryId, name]
    );
    return this.formatItem(result.rows[0]);
  }

  static async update(id, updates) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (updates.name) {
      fields.push(`name = $${paramCount++}`);
      values.push(updates.name);
    }

    if (fields.length === 0) return null;

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE dictionary_items SET ${fields.join(', ')} WHERE id = $${values.length}
       RETURNING *`,
      values
    );
    return result.rows[0] ? this.formatItem(result.rows[0]) : null;
  }

  static async delete(id) {
    const result = await pool.query(
      'DELETE FROM dictionary_items WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rows[0] !== undefined;
  }

  static formatItem(row) {
    if (!row) return null;
    return {
      id: row.id,
      dictionaryId: row.dictionary_id,
      parentId: row.parent_id,
      name: row.name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export default DictionaryItem;

