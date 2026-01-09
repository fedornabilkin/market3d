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
  return db.createTable('clusters', {
    id: {
      type: 'int',
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: 'int',
      notNull: true,
      foreignKey: {
        name: 'clusters_user_id_fk',
        table: 'users',
        rules: {
          onDelete: 'CASCADE',
          onUpdate: 'RESTRICT'
        },
        mapping: 'id'
      }
    },
    name: {
      type: 'string',
      length: 255,
      notNull: true
    },
    description: {
      type: 'text'
    },
    region_id: {
      type: 'int',
      foreignKey: {
        name: 'clusters_region_id_fk',
        table: 'dictionary_items',
        rules: {
          onDelete: 'SET NULL',
          onUpdate: 'RESTRICT'
        },
        mapping: 'id'
      }
    },
    city_id: {
      type: 'int',
      foreignKey: {
        name: 'clusters_city_id_fk',
        table: 'dictionary_items',
        rules: {
          onDelete: 'SET NULL',
          onUpdate: 'RESTRICT'
        },
        mapping: 'id'
      }
    },
    metro_id: {
      type: 'int',
      foreignKey: {
        name: 'clusters_metro_id_fk',
        table: 'dictionary_items',
        rules: {
          onDelete: 'SET NULL',
          onUpdate: 'RESTRICT'
        },
        mapping: 'id'
      }
    },
    parent_cluster_id: {
      type: 'int',
      foreignKey: {
        name: 'clusters_parent_cluster_id_fk',
        table: 'clusters',
        rules: {
          onDelete: 'SET NULL',
          onUpdate: 'RESTRICT'
        },
        mapping: 'id'
      }
    },
    state: {
      type: 'string',
      length: 20,
      defaultValue: 'draft',
      notNull: true
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
    // Добавляем CHECK constraint для state
    return db.runSql(`
      ALTER TABLE clusters 
      ADD CONSTRAINT clusters_state_check 
      CHECK (state IN ('draft', 'active', 'inactive', 'archived'));
    `);
  }).then(function () {
    // Добавляем индексы
    return db.addIndex('clusters', 'idx_clusters_user_id', ['user_id']);
  }).then(function () {
    return db.addIndex('clusters', 'idx_clusters_state', ['state']);
  }).then(function () {
    return db.addIndex('clusters', 'idx_clusters_parent_cluster_id', ['parent_cluster_id']);
  }).then(function () {
    return db.addIndex('clusters', 'idx_clusters_region_id', ['region_id']);
  }).then(function () {
    return db.addIndex('clusters', 'idx_clusters_city_id', ['city_id']);
  });
}

export async function down(db) {
  return db.removeIndex('clusters', 'idx_clusters_city_id').then(function () {
    return db.removeIndex('clusters', 'idx_clusters_region_id');
  }).then(function () {
    return db.removeIndex('clusters', 'idx_clusters_parent_cluster_id');
  }).then(function () {
    return db.removeIndex('clusters', 'idx_clusters_state');
  }).then(function () {
    return db.removeIndex('clusters', 'idx_clusters_user_id');
  }).then(function () {
    return db.runSql(`ALTER TABLE clusters DROP CONSTRAINT IF EXISTS clusters_state_check`);
  }).then(function () {
    return db.dropTable('clusters');
  });
}

export async function _meta() {
  return {
    version: 1
  };
}


