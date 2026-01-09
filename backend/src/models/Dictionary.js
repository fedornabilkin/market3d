import pool from '../config/database.js';

class Dictionary {
  static async findAll(filters = {}) {
    let query = 'SELECT * FROM dictionaries WHERE 1=1';
    const params = [];
    let paramCount = 1;

    // По умолчанию исключаем архивные справочники
    if (filters.includeArchived !== true) {
      query += ` AND state != 'archived'`;
    }

    if (filters.state) {
      query += ` AND state = $${paramCount++}`;
      params.push(filters.state);
    }

    query += ' ORDER BY name ASC';

    const result = await pool.query(query, params);
    return result.rows.map(row => this.formatDictionary(row));
  }

  static async findById(id) {
    const result = await pool.query(
      'SELECT * FROM dictionaries WHERE id = $1',
      [id]
    );
    return result.rows[0] ? this.formatDictionary(result.rows[0]) : null;
  }

  static async findByName(name) {
    const result = await pool.query(
      'SELECT * FROM dictionaries WHERE name = $1 AND state != \'archived\'',
      [name]
    );
    return result.rows[0] ? this.formatDictionary(result.rows[0]) : null;
  }

  static async create({ name, description, state = 'active' }) {
    const result = await pool.query(
      `INSERT INTO dictionaries (name, description, state, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING *`,
      [name, description, state]
    );
    return this.formatDictionary(result.rows[0]);
  }

  static async update(id, updates) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (updates.name) {
      fields.push(`name = $${paramCount++}`);
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      fields.push(`description = $${paramCount++}`);
      values.push(updates.description);
    }
    if (updates.state) {
      fields.push(`state = $${paramCount++}`);
      values.push(updates.state);
    }

    if (fields.length === 0) return null;

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE dictionaries SET ${fields.join(', ')} WHERE id = $${values.length}
       RETURNING *`,
      values
    );
    return result.rows[0] ? this.formatDictionary(result.rows[0]) : null;
  }

  static async archive(id) {
    const result = await pool.query(
      `UPDATE dictionaries SET state = 'archived', updated_at = NOW() WHERE id = $1
       RETURNING *`,
      [id]
    );
    return result.rows[0] ? this.formatDictionary(result.rows[0]) : null;
  }

  static formatDictionary(row) {
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      state: row.state,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export default Dictionary;

