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
  return db.createTable('notifications', {
    id: {
      type: 'int',
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: 'int',
      notNull: true,
      foreignKey: {
        name: 'notifications_user_id_fk',
        table: 'users',
        rules: {
          onDelete: 'CASCADE',
          onUpdate: 'RESTRICT'
        },
        mapping: 'id'
      }
    },
    message: {
      type: 'text',
      notNull: true
    },
    is_read: {
      type: 'boolean',
      defaultValue: false,
      notNull: true
    },
    created_at: {
      type: 'timestamp',
      defaultValue: new String('CURRENT_TIMESTAMP')
    }
  }).then(function () {
    return db.addIndex('notifications', 'idx_notifications_user_id', ['user_id']);
  }).then(function () {
    return db.addIndex('notifications', 'idx_notifications_is_read', ['is_read']);
  }).then(function () {
    return db.addIndex('notifications', 'idx_notifications_created_at', ['created_at']);
  });
};

export async function down (db) {
  return db.removeIndex('notifications', 'idx_notifications_created_at')
    .then(function () {
      return db.removeIndex('notifications', 'idx_notifications_is_read');
    })
    .then(function () {
      return db.removeIndex('notifications', 'idx_notifications_user_id');
    })
    .then(function () {
      return db.dropTable('notifications');
    });
};

export async function _meta () {
  return {
    version: 1
  }
};
