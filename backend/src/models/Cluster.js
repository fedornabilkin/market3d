import pool from '../config/database.js';

class Cluster {
  static async create({ userId, name, description, regionId, cityId, metroId, parentClusterId, state }) {
    const result = await pool.query(
      `INSERT INTO clusters (user_id, name, description, region_id, city_id, metro_id, parent_cluster_id, state, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       RETURNING *`,
      [userId, name, description || null, regionId, cityId, metroId || null, parentClusterId || null, state || 'draft']
    );
    return this.formatCluster(result.rows[0]);
  }

  static async findAll(filters = {}) {
    let query = `
      SELECT c.*, 
             u.email as user_email,
             r.name as region_name,
             city.name as city_name,
             m.name as metro_name,
             parent.name as parent_cluster_name
      FROM clusters c
      LEFT JOIN users u ON c.user_id = u.id
      LEFT JOIN dictionary_items r ON c.region_id = r.id
      LEFT JOIN dictionary_items city ON c.city_id = city.id
      LEFT JOIN dictionary_items m ON c.metro_id = m.id
      LEFT JOIN clusters parent ON c.parent_cluster_id = parent.id
      WHERE 1=1
    `;
    let countQuery = 'SELECT COUNT(*) as total FROM clusters c WHERE 1=1';
    const params = [];
    const countParams = [];
    let paramCount = 1;

    // Исключаем архивные кластеры по умолчанию
    if (filters.includeArchived !== true) {
      query += ` AND c.state != 'archived'`;
      countQuery += ` AND c.state != 'archived'`;
    }

    if (filters.userId) {
      query += ` AND c.user_id = $${paramCount}`;
      countQuery += ` AND c.user_id = $${paramCount}`;
      params.push(filters.userId);
      countParams.push(filters.userId);
      paramCount++;
    }
    if (filters.state) {
      query += ` AND c.state = $${paramCount}`;
      countQuery += ` AND c.state = $${paramCount}`;
      params.push(filters.state);
      countParams.push(filters.state);
      paramCount++;
    }
    if (filters.regionId) {
      query += ` AND c.region_id = $${paramCount}`;
      countQuery += ` AND c.region_id = $${paramCount}`;
      params.push(filters.regionId);
      countParams.push(filters.regionId);
      paramCount++;
    }
    if (filters.cityId) {
      query += ` AND c.city_id = $${paramCount}`;
      countQuery += ` AND c.city_id = $${paramCount}`;
      params.push(filters.cityId);
      countParams.push(filters.cityId);
      paramCount++;
    }

    // Пагинация
    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 20;
    const offset = (page - 1) * limit;

    query += ' ORDER BY c.created_at DESC';
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const [result, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, countParams),
    ]);

    const total = parseInt(countResult.rows[0].total);
    const pages = Math.ceil(total / limit);

    // Загружаем дополнительные данные для каждого кластера
    const clusters = await Promise.all(
      result.rows.map(async (row) => {
        const cluster = this.formatCluster(row);
        cluster.printersCount = await this.getPrintersCount(cluster.id);
        cluster.completedOrdersCount = await this.getCompletedOrdersCount(cluster.id);
        cluster.uniqueMaterials = await this.getUniqueMaterials(cluster.id);
        return cluster;
      })
    );

    return {
      data: clusters,
      total,
      page,
      limit,
      pages,
    };
  }

  static async findActive() {
    const result = await pool.query(
      `SELECT c.*, 
              u.email as user_email,
              r.name as region_name,
              city.name as city_name,
              m.name as metro_name
       FROM clusters c
       LEFT JOIN users u ON c.user_id = u.id
       LEFT JOIN dictionary_items r ON c.region_id = r.id
       LEFT JOIN dictionary_items city ON c.city_id = city.id
       LEFT JOIN dictionary_items m ON c.metro_id = m.id
       WHERE c.state = 'active'
       ORDER BY c.created_at DESC`
    );
    
    // Загружаем дополнительные данные для каждого кластера
    return await Promise.all(
      result.rows.map(async (row) => {
        const cluster = this.formatCluster(row);
        cluster.printersCount = await this.getPrintersCount(cluster.id);
        cluster.completedOrdersCount = await this.getCompletedOrdersCount(cluster.id);
        cluster.uniqueMaterials = await this.getUniqueMaterials(cluster.id);
        return cluster;
      })
    );
  }

  static async findById(id) {
    const result = await pool.query(
      `SELECT c.*, 
              u.email as user_email,
              r.name as region_name,
              city.name as city_name,
              m.name as metro_name,
              parent.name as parent_cluster_name,
              parent.id as parent_cluster_id
       FROM clusters c
       LEFT JOIN users u ON c.user_id = u.id
       LEFT JOIN dictionary_items r ON c.region_id = r.id
       LEFT JOIN dictionary_items city ON c.city_id = city.id
       LEFT JOIN dictionary_items m ON c.metro_id = m.id
       LEFT JOIN clusters parent ON c.parent_cluster_id = parent.id
       WHERE c.id = $1`,
      [id]
    );
    if (!result.rows[0]) return null;
    
    const cluster = this.formatCluster(result.rows[0]);
    cluster.printersCount = await this.getPrintersCount(id);
    cluster.completedOrdersCount = await this.getCompletedOrdersCount(id);
    cluster.uniqueMaterials = await this.getUniqueMaterials(id);
    return cluster;
  }

  static async update(id, updates, userId) {
    // Проверяем права доступа
    const cluster = await this.findById(id);
    if (!cluster) return null;

    if (cluster.userId !== userId) {
      return null;
    }

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
    if (updates.regionId !== undefined) {
      fields.push(`region_id = $${paramCount++}`);
      values.push(updates.regionId);
    }
    if (updates.cityId !== undefined) {
      fields.push(`city_id = $${paramCount++}`);
      values.push(updates.cityId);
    }
    if (updates.metroId !== undefined) {
      fields.push(`metro_id = $${paramCount++}`);
      values.push(updates.metroId);
    }
    if (updates.parentClusterId !== undefined) {
      fields.push(`parent_cluster_id = $${paramCount++}`);
      values.push(updates.parentClusterId);
    }
    if (updates.state) {
      fields.push(`state = $${paramCount++}`);
      values.push(updates.state);
    }

    if (fields.length === 0) return cluster;

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE clusters SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
    return result.rows[0] ? this.formatCluster(result.rows[0]) : null;
  }

  static async archive(id, userId) {
    // Проверяем права доступа
    const cluster = await this.findById(id);
    if (!cluster) return null;

    if (cluster.userId !== userId) {
      return null;
    }

    const result = await pool.query(
      `UPDATE clusters SET state = 'archived', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0] ? this.formatCluster(result.rows[0]) : null;
  }

  static async activate(id, userId) {
    // Проверяем права доступа
    const cluster = await this.findById(id);
    if (!cluster) return null;

    if (cluster.userId !== userId) {
      return null;
    }

    // Проверяем наличие принтеров
    const printersCount = await this.getPrintersCount(id);
    if (printersCount === 0) {
      return null; // Нельзя активировать без принтеров
    }

    const result = await pool.query(
      `UPDATE clusters SET state = 'active', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0] ? this.formatCluster(result.rows[0]) : null;
  }

  static async deactivateIfNoAvailablePrinters(id) {
    const availableCount = await this.getAvailablePrintersCount(id);
    if (availableCount === 0) {
      const result = await pool.query(
        `UPDATE clusters SET state = 'inactive', updated_at = NOW() WHERE id = $1 AND state = 'active' RETURNING *`,
        [id]
      );
      return result.rows[0] ? this.formatCluster(result.rows[0]) : null;
    }
    return null;
  }

  static async getPrintersCount(id) {
    const result = await pool.query(
      'SELECT COUNT(*) as total FROM cluster_printers WHERE cluster_id = $1',
      [id]
    );
    return parseInt(result.rows[0].total);
  }

  static async getAvailablePrintersCount(id) {
    const result = await pool.query(
      `SELECT COUNT(*) as total 
       FROM cluster_printers cp
       INNER JOIN printers p ON cp.printer_id = p.id
       WHERE cp.cluster_id = $1 AND p.state IN ('available', 'busy')`,
      [id]
    );
    return parseInt(result.rows[0].total);
  }

  static async getCompletedOrdersCount(id) {
    const result = await pool.query(
      `SELECT COUNT(*) as total 
       FROM order_clusters oc
       INNER JOIN orders o ON oc.order_id = o.id
       WHERE oc.cluster_id = $1 AND o.state = 'completed'`,
      [id]
    );
    return parseInt(result.rows[0].total);
  }

  static async getUniqueMaterials(id) {
    const result = await pool.query(
      `SELECT DISTINCT di.id, di.name
       FROM cluster_printers cp
       INNER JOIN printers p ON cp.printer_id = p.id
       INNER JOIN printer_materials pm ON p.id = pm.printer_id
       INNER JOIN dictionary_items di ON pm.material_id = di.id
       WHERE cp.cluster_id = $1 
       AND p.state IN ('available', 'busy')
       ORDER BY di.name ASC`,
      [id]
    );
    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
    }));
  }

  static async count() {
    const result = await pool.query(
      `SELECT COUNT(*) as total 
       FROM clusters 
       WHERE state != 'archived'`
    );
    return parseInt(result.rows[0].total);
  }

  static formatCluster(row) {
    if (!row) return null;
    return {
      id: row.id,
      userId: row.user_id,
      userEmail: row.user_email,
      name: row.name,
      description: row.description || '',
      regionId: row.region_id,
      regionName: row.region_name,
      cityId: row.city_id,
      cityName: row.city_name,
      metroId: row.metro_id,
      metroName: row.metro_name,
      parentClusterId: row.parent_cluster_id,
      parentClusterName: row.parent_cluster_name,
      state: row.state,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export default Cluster;


