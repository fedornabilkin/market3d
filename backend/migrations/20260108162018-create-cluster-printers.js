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
  return db.createTable('cluster_printers', {
    id: {
      type: 'int',
      primaryKey: true,
      autoIncrement: true
    },
    cluster_id: {
      type: 'int',
      notNull: true,
      foreignKey: {
        name: 'cluster_printers_cluster_id_fk',
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
        name: 'cluster_printers_printer_id_fk',
        table: 'printers',
        rules: {
          onDelete: 'CASCADE',
          onUpdate: 'RESTRICT'
        },
        mapping: 'id'
      }
    },
    added_by: {
      type: 'int',
      notNull: true,
      foreignKey: {
        name: 'cluster_printers_added_by_fk',
        table: 'users',
        rules: {
          onDelete: 'RESTRICT',
          onUpdate: 'RESTRICT'
        },
        mapping: 'id'
      }
    },
    added_at: {
      type: 'timestamp',
      defaultValue: new String('CURRENT_TIMESTAMP')
    }
  }).then(function () {
    // Добавляем уникальное ограничение
    return db.runSql(`
      ALTER TABLE cluster_printers 
      ADD CONSTRAINT cluster_printers_unique 
      UNIQUE (cluster_id, printer_id);
    `);
  }).then(function () {
    // Добавляем индексы
    return db.addIndex('cluster_printers', 'idx_cluster_printers_cluster_id', ['cluster_id']);
  }).then(function () {
    return db.addIndex('cluster_printers', 'idx_cluster_printers_printer_id', ['printer_id']);
  });
}

export async function down(db) {
  return db.removeIndex('cluster_printers', 'idx_cluster_printers_printer_id').then(function () {
    return db.removeIndex('cluster_printers', 'idx_cluster_printers_cluster_id');
  }).then(function () {
    return db.runSql(`ALTER TABLE cluster_printers DROP CONSTRAINT IF EXISTS cluster_printers_unique`);
  }).then(function () {
    return db.dropTable('cluster_printers');
  });
}

export async function _meta() {
  return {
    version: 1
  };
}


