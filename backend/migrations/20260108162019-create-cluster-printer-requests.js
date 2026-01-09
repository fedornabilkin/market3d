'use strict';

var dbm;
var type;
var seed;

/**
 * We receive the dbmigrate dependency from dbmigrate initially.
 * This enables us to not require to depend on @dbmigrate/plugin-type-postgresql
 */
export async function setup(options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
}

export async function up(db) {
  return db.createTable('cluster_printer_requests', {
    id: {
      type: 'int',
      primaryKey: true,
      autoIncrement: true
    },
    cluster_id: {
      type: 'int',
      notNull: true,
      foreignKey: {
        name: 'cluster_printer_requests_cluster_id_fk',
        table: 'clusters',
        rules: {
          onDelete: 'CASCADE',
          onUpdate: 'RESTRICT'
        },
        mapping: 'id'
      }
    },
    printer_id: {
      type: 'int',
      notNull: true,
      foreignKey: {
        name: 'cluster_printer_requests_printer_id_fk',
        table: 'printers',
        rules: {
          onDelete: 'CASCADE',
          onUpdate: 'RESTRICT'
        },
        mapping: 'id'
      }
    },
    requested_by: {
      type: 'int',
      notNull: true,
      foreignKey: {
        name: 'cluster_printer_requests_requested_by_fk',
        table: 'users',
        rules: {
          onDelete: 'RESTRICT',
          onUpdate: 'RESTRICT'
        },
        mapping: 'id'
      }
    },
    printer_owner_id: {
      type: 'int',
      notNull: true,
      foreignKey: {
        name: 'cluster_printer_requests_printer_owner_id_fk',
        table: 'users',
        rules: {
          onDelete: 'RESTRICT',
          onUpdate: 'RESTRICT'
        },
        mapping: 'id'
      }
    },
    status: {
      type: 'string',
      length: 20,
      defaultValue: 'pending',
      notNull: true
    },
    message: {
      type: 'text'
    },
    created_at: {
      type: 'timestamp',
      defaultValue: new String('CURRENT_TIMESTAMP')
    },
    updated_at: {
      type: 'timestamp',
      defaultValue: new String('CURRENT_TIMESTAMP')
    }
  }).then(function () {
    // Добавляем CHECK constraint для status
    return db.runSql(`
      ALTER TABLE cluster_printer_requests 
      ADD CONSTRAINT cluster_printer_requests_status_check 
      CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'));
    `);
  }).then(function () {
    // Добавляем индексы
    return db.addIndex('cluster_printer_requests', 'idx_cluster_printer_requests_cluster_id', ['cluster_id']);
  }).then(function () {
    return db.addIndex('cluster_printer_requests', 'idx_cluster_printer_requests_printer_id', ['printer_id']);
  }).then(function () {
    return db.addIndex('cluster_printer_requests', 'idx_cluster_printer_requests_requested_by', ['requested_by']);
  }).then(function () {
    return db.addIndex('cluster_printer_requests', 'idx_cluster_printer_requests_printer_owner_id', ['printer_owner_id']);
  }).then(function () {
    return db.addIndex('cluster_printer_requests', 'idx_cluster_printer_requests_status', ['status']);
  });
}

export async function down(db) {
  return db.removeIndex('cluster_printer_requests', 'idx_cluster_printer_requests_status').then(function () {
    return db.removeIndex('cluster_printer_requests', 'idx_cluster_printer_requests_printer_owner_id');
  }).then(function () {
    return db.removeIndex('cluster_printer_requests', 'idx_cluster_printer_requests_requested_by');
  }).then(function () {
    return db.removeIndex('cluster_printer_requests', 'idx_cluster_printer_requests_printer_id');
  }).then(function () {
    return db.removeIndex('cluster_printer_requests', 'idx_cluster_printer_requests_cluster_id');
  }).then(function () {
    return db.runSql(`ALTER TABLE cluster_printer_requests DROP CONSTRAINT IF EXISTS cluster_printer_requests_status_check`);
  }).then(function () {
    return db.dropTable('cluster_printer_requests');
  });
}

export async function _meta() {
  return {
    version: 1
  };
}


