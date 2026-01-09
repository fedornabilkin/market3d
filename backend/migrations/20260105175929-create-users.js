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
  return db.createTable('users', {
    id: {
      type: 'int',
      primaryKey: true,
      autoIncrement: true
    },
    email: {
      type: 'string',
      length: 255,
      unique: true,
      notNull: true
    },
    password_hash: {
      type: 'string',
      length: 255,
      notNull: true
    },
    password_salt: {
      type: 'string',
      length: 255,
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
    return db.addIndex('users', 'idx_users_email', ['email']);
  });
};

export async function down (db) {
  return db.removeIndex('users', 'idx_users_email').then(function () {
    return db.dropTable('users');
  });
};

export async function _meta () {
  return {
    version: 1
  }
};

