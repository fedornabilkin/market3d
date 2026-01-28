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
  return db.createTable('cluster_deliveries', {
    id: {
      type: 'int',
      primaryKey: true,
      autoIncrement: true
    },
    cluster_id: {
      type: 'int',
      notNull: true,
      foreignKey: {
        name: 'cluster_deliveries_cluster_id_fk',
        table: 'clusters',
        rules: {
          onDelete: 'CASCADE',
          onUpdate: 'RESTRICT'
        },
        mapping: 'id'
      }
    },
    delivery_method_id: {
      type: 'int',
      notNull: true,
      foreignKey: {
        name: 'cluster_deliveries_delivery_method_id_fk',
        table: 'dictionary_items',
        rules: {
          onDelete: 'CASCADE',
          onUpdate: 'RESTRICT'
        },
        mapping: 'id'
      }
    },
    created_at: {
      type: 'timestamp',
      defaultValue: new String('CURRENT_TIMESTAMP')
    }
  }).then(function () {
    // Добавляем уникальное ограничение
    return db.runSql(`
      ALTER TABLE cluster_deliveries 
      ADD CONSTRAINT cluster_deliveries_unique 
      UNIQUE (cluster_id, delivery_method_id);
    `);
  }).then(function () {
    // Добавляем индексы
    return db.addIndex('cluster_deliveries', 'idx_cluster_deliveries_cluster_id', ['cluster_id']);
  }).then(function () {
    return db.addIndex('cluster_deliveries', 'idx_cluster_deliveries_delivery_method_id', ['delivery_method_id']);
  });
}

export async function down(db) {
  return db.removeIndex('cluster_deliveries', 'idx_cluster_deliveries_delivery_method_id').then(function () {
    return db.removeIndex('cluster_deliveries', 'idx_cluster_deliveries_cluster_id');
  }).then(function () {
    return db.runSql(`ALTER TABLE cluster_deliveries DROP CONSTRAINT IF EXISTS cluster_deliveries_unique`);
  }).then(function () {
    return db.dropTable('cluster_deliveries');
  });
}

export async function _meta() {
  return {
    version: 1
  };
}
