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
  return db.createTable('order_messages', {
    id: {
      type: 'int',
      primaryKey: true,
      autoIncrement: true
    },
    order_id: {
      type: 'int',
      notNull: true,
      foreignKey: {
        name: 'order_messages_order_id_fk',
        table: 'orders',
        rules: {
          onDelete: 'CASCADE'
        },
        mapping: 'id'
      }
    },
    sender_id: {
      type: 'int',
      notNull: true,
      foreignKey: {
        name: 'order_messages_sender_id_fk',
        table: 'users',
        rules: {
          onDelete: 'CASCADE'
        },
        mapping: 'id'
      }
    },
    message: {
      type: 'text',
      notNull: true
    },
    created_at: {
      type: 'timestamp',
      defaultValue: new String('CURRENT_TIMESTAMP')
    }
  }).then(function () {
    return db.addIndex('order_messages', 'idx_order_messages_order_id', ['order_id']);
  });
};

export async function down (db) {
  return db.removeIndex('order_messages', 'idx_order_messages_order_id')
    .then(function () {
      return db.dropTable('order_messages');
    });
};

export async function _meta () {
  return {
    version: 1
  }
};

