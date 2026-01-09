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
};

export async function up (db) {
  return db.createTable('order_files', {
    id: {
      type: 'int',
      primaryKey: true,
      autoIncrement: true
    },
    order_id: {
      type: 'int',
      notNull: true,
      foreignKey: {
        name: 'order_files_order_id_fk',
        table: 'orders',
        rules: {
          onDelete: 'CASCADE'
        },
        mapping: 'id'
      }
    },
    file_url: {
      type: 'string',
      length: 500,
      notNull: true
    },
    file_name: {
      type: 'string',
      length: 255,
      notNull: true
    },
    file_size: {
      type: 'int'
    },
    file_type: {
      type: 'string',
      length: 50
    },
    created_at: {
      type: 'timestamp',
      defaultValue: new String('CURRENT_TIMESTAMP')
    }
  }).then(function () {
    return db.addIndex('order_files', 'idx_order_files_order_id', ['order_id']);
  });
};

export async function down (db) {
  return db.removeIndex('order_files', 'idx_order_files_order_id')
    .then(function () {
      return db.dropTable('order_files');
    });
};

export async function _meta () {
  return {
    version: 1
  }
};

