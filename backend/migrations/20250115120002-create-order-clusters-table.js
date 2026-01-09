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
  return db.createTable('order_clusters', {
    id: {
      type: 'int',
      primaryKey: true,
      autoIncrement: true
    },
    order_id: {
      type: 'int',
      notNull: true,
      foreignKey: {
        name: 'order_clusters_order_id_fk',
        table: 'orders',
        rules: {
          onDelete: 'CASCADE',
          onUpdate: 'RESTRICT'
        },
        mapping: 'id'
      }
    },
    cluster_id: {
      type: 'int',
      notNull: true,
      foreignKey: {
        name: 'order_clusters_cluster_id_fk',
        table: 'clusters',
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
      ALTER TABLE order_clusters 
      ADD CONSTRAINT order_clusters_unique 
      UNIQUE (order_id, cluster_id);
    `);
  }).then(function () {
    // Добавляем индексы
    return db.addIndex('order_clusters', 'idx_order_clusters_order_id', ['order_id']);
  }).then(function () {
    return db.addIndex('order_clusters', 'idx_order_clusters_cluster_id', ['cluster_id']);
  });
}

export async function down(db) {
  return db.removeIndex('order_clusters', 'idx_order_clusters_cluster_id').then(function () {
    return db.removeIndex('order_clusters', 'idx_order_clusters_order_id');
  }).then(function () {
    return db.runSql(`ALTER TABLE order_clusters DROP CONSTRAINT IF EXISTS order_clusters_unique`);
  }).then(function () {
    return db.dropTable('order_clusters');
  });
}

export async function _meta() {
  return {
    version: 1
  };
}
