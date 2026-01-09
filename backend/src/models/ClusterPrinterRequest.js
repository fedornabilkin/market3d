import pool from '../config/database.js';
import ClusterPrinter from './ClusterPrinter.js';

class ClusterPrinterRequest {
  static async create({ clusterId, printerId, requestedBy, message }) {
    // Получаем владельца принтера
    const printerResult = await pool.query('SELECT user_id FROM printers WHERE id = $1', [printerId]);
    if (printerResult.rows.length === 0) {
      return null; // Принтер не найден
    }
    const printerOwnerId = printerResult.rows[0].user_id;

    // Проверяем, нет ли уже активного запроса
    const existing = await this.findPending(clusterId, printerId);
    if (existing) {
      return null; // Уже есть активный запрос
    }

    // Проверяем, не привязан ли уже принтер
    const isAttached = await ClusterPrinter.isAttached(clusterId, printerId);
    if (isAttached) {
      return null; // Принтер уже привязан
    }

    const result = await pool.query(
      `INSERT INTO cluster_printer_requests (cluster_id, printer_id, requested_by, printer_owner_id, status, message, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'pending', $5, NOW(), NOW())
       RETURNING *`,
      [clusterId, printerId, requestedBy, printerOwnerId, message || null]
    );
    return this.formatRequest(result.rows[0]);
  }

  static async findByClusterId(clusterId) {
    const result = await pool.query(
      `SELECT cpr.*, 
              c.name as cluster_name,
              p.model_name, p.manufacturer,
              u1.email as requested_by_email,
              u2.email as printer_owner_email
       FROM cluster_printer_requests cpr
       LEFT JOIN clusters c ON cpr.cluster_id = c.id
       LEFT JOIN printers p ON cpr.printer_id = p.id
       LEFT JOIN users u1 ON cpr.requested_by = u1.id
       LEFT JOIN users u2 ON cpr.printer_owner_id = u2.id
       WHERE cpr.cluster_id = $1
       ORDER BY cpr.created_at DESC`,
      [clusterId]
    );
    return result.rows.map(row => this.formatRequest(row));
  }

  static async findByPrinterId(printerId) {
    const result = await pool.query(
      `SELECT cpr.*, 
              c.name as cluster_name,
              p.model_name, p.manufacturer,
              u1.email as requested_by_email,
              u2.email as printer_owner_email
       FROM cluster_printer_requests cpr
       LEFT JOIN clusters c ON cpr.cluster_id = c.id
       LEFT JOIN printers p ON cpr.printer_id = p.id
       LEFT JOIN users u1 ON cpr.requested_by = u1.id
       LEFT JOIN users u2 ON cpr.printer_owner_id = u2.id
       WHERE cpr.printer_id = $1
       ORDER BY cpr.created_at DESC`,
      [printerId]
    );
    return result.rows.map(row => this.formatRequest(row));
  }

  static async findByPrinterOwner(printerOwnerId) {
    const result = await pool.query(
      `SELECT cpr.*, 
              c.name as cluster_name,
              p.model_name, p.manufacturer,
              u1.email as requested_by_email,
              u2.email as printer_owner_email
       FROM cluster_printer_requests cpr
       LEFT JOIN clusters c ON cpr.cluster_id = c.id
       LEFT JOIN printers p ON cpr.printer_id = p.id
       LEFT JOIN users u1 ON cpr.requested_by = u1.id
       LEFT JOIN users u2 ON cpr.printer_owner_id = u2.id
       WHERE cpr.printer_owner_id = $1
       ORDER BY cpr.created_at DESC`,
      [printerOwnerId]
    );
    return result.rows.map(row => this.formatRequest(row));
  }

  static async findPending(clusterId, printerId) {
    const result = await pool.query(
      `SELECT * FROM cluster_printer_requests 
       WHERE cluster_id = $1 AND printer_id = $2 AND status = 'pending'`,
      [clusterId, printerId]
    );
    return result.rows.length > 0 ? this.formatRequest(result.rows[0]) : null;
  }

  static async findById(id) {
    const result = await pool.query(
      `SELECT cpr.*, 
              c.name as cluster_name,
              p.model_name, p.manufacturer,
              u1.email as requested_by_email,
              u2.email as printer_owner_email
       FROM cluster_printer_requests cpr
       LEFT JOIN clusters c ON cpr.cluster_id = c.id
       LEFT JOIN printers p ON cpr.printer_id = p.id
       LEFT JOIN users u1 ON cpr.requested_by = u1.id
       LEFT JOIN users u2 ON cpr.printer_owner_id = u2.id
       WHERE cpr.id = $1`,
      [id]
    );
    return result.rows[0] ? this.formatRequest(result.rows[0]) : null;
  }

  static async approve(id, printerOwnerId) {
    // Проверяем права доступа
    const request = await this.findById(id);
    if (!request) return null;

    if (request.printerOwnerId !== printerOwnerId) {
      return null; // Только владелец принтера может одобрить
    }

    if (request.status !== 'pending') {
      return null; // Только pending запросы можно одобрить
    }

    // Обновляем статус
    const result = await pool.query(
      `UPDATE cluster_printer_requests 
       SET status = 'approved', updated_at = NOW() 
       WHERE id = $1 
       RETURNING *`,
      [id]
    );

    if (result.rows.length > 0) {
      // Привязываем принтер к кластеру
      await ClusterPrinter.attach(request.clusterId, request.printerId, request.requestedBy);
    }

    return result.rows[0] ? this.formatRequest(result.rows[0]) : null;
  }

  static async reject(id, printerOwnerId) {
    // Проверяем права доступа
    const request = await this.findById(id);
    if (!request) return null;

    if (request.printerOwnerId !== printerOwnerId) {
      return null; // Только владелец принтера может отклонить
    }

    if (request.status !== 'pending') {
      return null; // Только pending запросы можно отклонить
    }

    const result = await pool.query(
      `UPDATE cluster_printer_requests 
       SET status = 'rejected', updated_at = NOW() 
       WHERE id = $1 
       RETURNING *`,
      [id]
    );
    return result.rows[0] ? this.formatRequest(result.rows[0]) : null;
  }

  static async cancel(id, requestedBy) {
    // Проверяем права доступа
    const request = await this.findById(id);
    if (!request) return null;

    if (request.requestedBy !== requestedBy) {
      return null; // Только автор запроса может отменить
    }

    if (request.status !== 'pending') {
      return null; // Только pending запросы можно отменить
    }

    const result = await pool.query(
      `UPDATE cluster_printer_requests 
       SET status = 'cancelled', updated_at = NOW() 
       WHERE id = $1 
       RETURNING *`,
      [id]
    );
    return result.rows[0] ? this.formatRequest(result.rows[0]) : null;
  }

  static formatRequest(row) {
    if (!row) return null;
    return {
      id: row.id,
      clusterId: row.cluster_id,
      printerId: row.printer_id,
      requestedBy: row.requested_by,
      printerOwnerId: row.printer_owner_id,
      status: row.status,
      message: row.message || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      clusterName: row.cluster_name,
      printerModelName: row.model_name,
      printerManufacturer: row.manufacturer,
      requestedByEmail: row.requested_by_email,
      printerOwnerEmail: row.printer_owner_email,
    };
  }
}

export default ClusterPrinterRequest;


