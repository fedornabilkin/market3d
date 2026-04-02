import pool from '../config/database.js';
import Printer from './Printer.js';

class ClusterPrinter {
  static async attach(clusterId, printerId, userId) {
    // Проверяем, не привязан ли уже принтер
    const existing = await this.isAttached(clusterId, printerId);
    if (existing) {
      return null; // Уже привязан
    }

    const result = await pool.query(
      `INSERT INTO cluster_printers (cluster_id, printer_id, added_by, added_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      [clusterId, printerId, userId]
    );

    // Обновляем cluster_id в таблице printers для быстрого доступа
    await pool.query(
      `UPDATE printers SET cluster_id = $1 WHERE id = $2`,
      [clusterId, printerId]
    );

    return result.rows[0];
  }

  static async detach(clusterId, printerId, userId) {
    // Проверяем права: автор кластера или владелец принтера
    const clusterResult = await pool.query('SELECT user_id FROM clusters WHERE id = $1', [clusterId]);
    const printerResult = await pool.query('SELECT user_id FROM printers WHERE id = $1', [printerId]);

    if (clusterResult.rows.length === 0 || printerResult.rows.length === 0) {
      return null;
    }

    const clusterOwnerId = clusterResult.rows[0].user_id;
    const printerOwnerId = printerResult.rows[0].user_id;

    if (clusterOwnerId !== userId && printerOwnerId !== userId) {
      return null; // Нет прав
    }

    const result = await pool.query(
      `DELETE FROM cluster_printers 
       WHERE cluster_id = $1 AND printer_id = $2
       RETURNING *`,
      [clusterId, printerId]
    );

    if (result.rows.length > 0) {
      // Обновляем cluster_id в таблице printers
      await pool.query(
        `UPDATE printers SET cluster_id = NULL WHERE id = $1`,
        [printerId]
      );
    }

    return result.rows[0] || null;
  }

  static async findByClusterId(clusterId) {
    const result = await pool.query(
      `SELECT cp.*, 
              p.id as printer_id_full,
              p.user_id as printer_user_id,
              p.model_name, p.manufacturer, p.price_per_hour, p.state as printer_state,
              u.email as printer_owner_email
       FROM cluster_printers cp
       INNER JOIN printers p ON cp.printer_id = p.id
       LEFT JOIN users u ON p.user_id = u.id
       WHERE cp.cluster_id = $1
       ORDER BY cp.added_at DESC`,
      [clusterId]
    );
    
    // Загружаем материалы и цвета для каждого принтера
    const printers = await Promise.all(
      result.rows.map(async (row) => {
        const printer = Printer.formatPrinter({
          id: row.printer_id_full,
          user_id: row.printer_user_id,
          model_name: row.model_name,
          manufacturer: row.manufacturer,
          price_per_hour: row.price_per_hour,
          state: row.printer_state,
          cluster_id: clusterId,
          cluster_name: null,
        });
        
        // Загружаем материалы и цвета
        printer.materials = await Printer.getMaterials(row.printer_id_full);
        printer.colors = await Printer.getColors(row.printer_id_full);
        
        return {
          id: row.id,
          clusterId: row.cluster_id,
          printerId: row.printer_id,
          addedBy: row.added_by,
          addedAt: row.added_at,
          printer,
        };
      })
    );
    
    return printers;
  }

  static async findByPrinterId(printerId) {
    const result = await pool.query(
      `SELECT cp.*, 
              c.name as cluster_name, c.state as cluster_state
       FROM cluster_printers cp
       INNER JOIN clusters c ON cp.cluster_id = c.id
       WHERE cp.printer_id = $1`,
      [printerId]
    );
    return result.rows.map(row => ({
      id: row.id,
      clusterId: row.cluster_id,
      printerId: row.printer_id,
      addedBy: row.added_by,
      addedAt: row.added_at,
      clusterName: row.cluster_name,
      clusterState: row.cluster_state
    }));
  }

  static async isAttached(clusterId, printerId) {
    const result = await pool.query(
      'SELECT id FROM cluster_printers WHERE cluster_id = $1 AND printer_id = $2',
      [clusterId, printerId]
    );
    return result.rows.length > 0;
  }

  static async getAvailableCount(clusterId) {
    const result = await pool.query(
      `SELECT COUNT(*) as total 
       FROM cluster_printers cp
       INNER JOIN printers p ON cp.printer_id = p.id
       WHERE cp.cluster_id = $1 AND p.state IN ('available', 'busy')`,
      [clusterId]
    );
    return parseInt(result.rows[0].total);
  }
}

export default ClusterPrinter;

