import pool from '../config/database.js';

class Printer {
  static async create({ userId, modelName, manufacturer, pricePerHour, state, materialIds, colorIds }) {
    // Валидация цены - только целые числа
    if (pricePerHour === undefined || pricePerHour === null || typeof pricePerHour !== 'number' || pricePerHour < 1 || !Number.isInteger(pricePerHour)) {
      throw new Error('Price per hour must be a positive integer (minimum 1)');
    }

    const result = await pool.query(
      `INSERT INTO printers (user_id, model_name, manufacturer, price_per_hour, state, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING *`,
      [userId, modelName, manufacturer, pricePerHour, state || 'available']
    );
    
    const printer = this.formatPrinter(result.rows[0]);
    
    // Добавляем материалы, если они указаны
    if (materialIds && Array.isArray(materialIds) && materialIds.length > 0) {
      printer.materials = await this.addMaterials(printer.id, materialIds);
    } else {
      printer.materials = [];
    }
    
    // Добавляем цвета, если они указаны
    if (colorIds && Array.isArray(colorIds) && colorIds.length > 0) {
      printer.colors = await this.addColors(printer.id, colorIds);
    } else {
      printer.colors = [];
    }
    
    return printer;
  }

  static async findAll(filters = {}) {
    let query = 'SELECT * FROM printers WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as total FROM printers WHERE 1=1';
    const params = [];
    const countParams = [];
    let paramCount = 1;

    // Исключаем архивные принтеры по умолчанию
    if (filters.includeArchived !== true) {
      query += ` AND state != 'archived'`;
      countQuery += ` AND state != 'archived'`;
    }

    if (filters.userId) {
      query += ` AND user_id = $${paramCount}`;
      countQuery += ` AND user_id = $${paramCount}`;
      params.push(filters.userId);
      countParams.push(filters.userId);
      paramCount++;
    }
    if (filters.clusterId !== undefined) {
      if (filters.clusterId === 0) {
        // Принтеры БЕЗ кластера
        query += ` AND cluster_id IS NULL`;
        countQuery += ` AND cluster_id IS NULL`;
      } else {
        // Принтеры с конкретным кластером
        query += ` AND cluster_id = $${paramCount}`;
        countQuery += ` AND cluster_id = $${paramCount}`;
        params.push(filters.clusterId);
        countParams.push(filters.clusterId);
        paramCount++;
      }
    }
    if (filters.state) {
      query += ` AND state = $${paramCount}`;
      countQuery += ` AND state = $${paramCount}`;
      params.push(filters.state);
      countParams.push(filters.state);
      paramCount++;
    }

    // Пагинация
    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 20;
    const offset = (page - 1) * limit;

    query += ' ORDER BY created_at DESC';
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const [result, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, countParams),
    ]);

    const total = parseInt(countResult.rows[0].total);
    const pages = Math.ceil(total / limit);

    // Загружаем материалы и цвета для каждого принтера
    const printers = await Promise.all(
      result.rows.map(async (row) => {
        const printer = this.formatPrinter(row);
        printer.materials = await this.getMaterials(printer.id);
        printer.colors = await this.getColors(printer.id);
        return printer;
      })
    );

    return {
      data: printers,
      total,
      page,
      limit,
      pages,
    };
  }

  static async findRecent(limit = 5) {
    const result = await pool.query(
      'SELECT * FROM printers WHERE state != \'archived\' ORDER BY created_at DESC LIMIT $1',
      [limit]
    );
    return result.rows.map(row => this.formatPrinter(row));
  }

  static async count() {
    const result = await pool.query(
      'SELECT COUNT(*) as total FROM printers WHERE state != \'archived\''
    );
    return parseInt(result.rows[0].total);
  }

  static async findById(id) {
    const result = await pool.query(
      `SELECT p.*, 
              c.id as cluster_id_from_cluster,
              c.name as cluster_name
       FROM printers p
       LEFT JOIN clusters c ON p.cluster_id = c.id
       WHERE p.id = $1`,
      [id]
    );
    if (!result.rows[0]) return null;
    
    const printer = this.formatPrinter(result.rows[0]);
    // Загружаем материалы и цвета
    printer.materials = await this.getMaterials(id);
    printer.colors = await this.getColors(id);
    return printer;
  }

  static async findByClusterId(clusterId) {
    const result = await pool.query(
      'SELECT * FROM printers WHERE cluster_id = $1 ORDER BY created_at DESC',
      [clusterId]
    );
    return result.rows.map(row => this.formatPrinter(row));
  }

  static async update(id, updates, userId) {
    // Валидация цены - только целые числа
    if (updates.pricePerHour !== undefined) {
      if (typeof updates.pricePerHour !== 'number' || updates.pricePerHour < 1 || !Number.isInteger(updates.pricePerHour)) {
        throw new Error('Price per hour must be a positive integer (minimum 1)');
      }
    }

    const fields = [];
    const values = [];
    let paramCount = 1;

    if (updates.modelName) {
      fields.push(`model_name = $${paramCount++}`);
      values.push(updates.modelName);
    }
    if (updates.manufacturer) {
      fields.push(`manufacturer = $${paramCount++}`);
      values.push(updates.manufacturer);
    }
    if (updates.pricePerHour !== undefined) {
      fields.push(`price_per_hour = $${paramCount++}`);
      values.push(updates.pricePerHour);
    }
    if (updates.state) {
      fields.push(`state = $${paramCount++}`);
      values.push(updates.state);
    }

    if (fields.length === 0) return null;

    fields.push(`updated_at = NOW()`);
    values.push(id, userId);

    const result = await pool.query(
      `UPDATE printers SET ${fields.join(', ')} WHERE id = $${values.length - 1} AND user_id = $${values.length}
       RETURNING *`,
      values
    );
    if (!result.rows[0]) return null;
    
    const printer = this.formatPrinter(result.rows[0]);
    // Загружаем материалы и цвета
    printer.materials = await this.getMaterials(id);
    printer.colors = await this.getColors(id);
    return printer;
  }

  static async archive(id, userId) {
    const result = await pool.query(
      `UPDATE printers SET state = 'archived', updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *`,
      [id, userId]
    );
    return result.rows[0] ? this.formatPrinter(result.rows[0]) : null;
  }

  static async getMaterials(printerId) {
    const result = await pool.query(
      `SELECT di.id, di.name, di.dictionary_id
       FROM printer_materials pm
       INNER JOIN dictionary_items di ON pm.material_id = di.id
       WHERE pm.printer_id = $1
       ORDER BY di.name ASC`,
      [printerId]
    );
    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      dictionaryId: row.dictionary_id,
    }));
  }

  static async addMaterials(printerId, materialIds) {
    if (!Array.isArray(materialIds) || materialIds.length === 0) {
      throw new Error('Material IDs must be a non-empty array');
    }

    // Проверяем существование материалов в справочнике
    const materialsCheck = await pool.query(
      `SELECT id FROM dictionary_items 
       WHERE id = ANY($1::int[]) 
       AND dictionary_id = (SELECT id FROM dictionaries WHERE name = 'materials')`,
      [materialIds]
    );

    if (materialsCheck.rows.length !== materialIds.length) {
      throw new Error('Some material IDs are invalid or not found in materials dictionary');
    }

    // Удаляем существующие связи для этих материалов (чтобы избежать дубликатов)
    await pool.query(
      `DELETE FROM printer_materials 
       WHERE printer_id = $1 AND material_id = ANY($2::int[])`,
      [printerId, materialIds]
    );

    // Добавляем новые связи
    const values = materialIds.map((_, index) => `($1, $${index + 2}, NOW())`).join(', ');
    const params = [printerId, ...materialIds];
    
    await pool.query(
      `INSERT INTO printer_materials (printer_id, material_id, created_at)
       VALUES ${values}`,
      params
    );

    return this.getMaterials(printerId);
  }

  static async removeMaterials(printerId, materialIds) {
    if (!Array.isArray(materialIds) || materialIds.length === 0) {
      throw new Error('Material IDs must be a non-empty array');
    }

    const result = await pool.query(
      `DELETE FROM printer_materials 
       WHERE printer_id = $1 AND material_id = ANY($2::int[])
       RETURNING material_id`,
      [printerId, materialIds]
    );

    return result.rows.map(row => row.material_id);
  }

  static async getColors(printerId) {
    const result = await pool.query(
      `SELECT di.id, di.name, di.dictionary_id
       FROM printer_colors pc
       INNER JOIN dictionary_items di ON pc.color_id = di.id
       WHERE pc.printer_id = $1
       ORDER BY di.name ASC`,
      [printerId]
    );
    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      dictionaryId: row.dictionary_id,
    }));
  }

  static async addColors(printerId, colorIds) {
    if (!Array.isArray(colorIds) || colorIds.length === 0) {
      throw new Error('Color IDs must be a non-empty array');
    }

    // Проверяем существование цветов в справочнике
    const colorsCheck = await pool.query(
      `SELECT id FROM dictionary_items 
       WHERE id = ANY($1::int[]) 
       AND dictionary_id = (SELECT id FROM dictionaries WHERE name = 'colors')`,
      [colorIds]
    );

    if (colorsCheck.rows.length !== colorIds.length) {
      throw new Error('Some color IDs are invalid or not found in colors dictionary');
    }

    // Удаляем существующие связи для этих цветов (чтобы избежать дубликатов)
    await pool.query(
      `DELETE FROM printer_colors 
       WHERE printer_id = $1 AND color_id = ANY($2::int[])`,
      [printerId, colorIds]
    );

    // Добавляем новые связи
    const values = colorIds.map((_, index) => `($1, $${index + 2}, NOW())`).join(', ');
    const params = [printerId, ...colorIds];
    
    await pool.query(
      `INSERT INTO printer_colors (printer_id, color_id, created_at)
       VALUES ${values}`,
      params
    );

    return this.getColors(printerId);
  }

  static async removeColors(printerId, colorIds) {
    if (!Array.isArray(colorIds) || colorIds.length === 0) {
      throw new Error('Color IDs must be a non-empty array');
    }

    const result = await pool.query(
      `DELETE FROM printer_colors 
       WHERE printer_id = $1 AND color_id = ANY($2::int[])
       RETURNING color_id`,
      [printerId, colorIds]
    );

    return result.rows.map(row => row.color_id);
  }

  static formatPrinter(row) {
    if (!row) return null;
    return {
      ...row,
      userId: row.user_id,
      clusterId: row.cluster_id || row.cluster_id_from_cluster,
      clusterName: row.cluster_name,
      pricePerHour: parseFloat(row.price_per_hour),
      state: row.state,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export default Printer;

