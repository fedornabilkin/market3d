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
  return db.createTable('addresses', {
    id: {
      type: 'int',
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: 'int',
      foreignKey: {
        name: 'addresses_user_id_fk',
        table: 'users',
        rules: {
          onDelete: 'CASCADE'
        },
        mapping: 'id'
      }
    },
    printer_id: {
      type: 'int',
      foreignKey: {
        name: 'addresses_printer_id_fk',
        table: 'printers',
        rules: {
          onDelete: 'CASCADE'
        },
        mapping: 'id'
      }
    },
    address_line: {
      type: 'text',
      notNull: true
    },
    city: {
      type: 'string',
      length: 100
    },
    region: {
      type: 'string',
      length: 100
    },
    country: {
      type: 'string',
      length: 100
    },
    postal_code: {
      type: 'string',
      length: 20
    },
    latitude: {
      type: 'decimal',
      precision: 10,
      scale: 8
    },
    longitude: {
      type: 'decimal',
      precision: 11,
      scale: 8
    },
    is_primary: {
      type: 'boolean',
      defaultValue: false
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
    return db.runSql(
      'ALTER TABLE addresses ADD CONSTRAINT check_reference CHECK ' +
      '((user_id IS NOT NULL AND printer_id IS NULL) OR (user_id IS NULL AND printer_id IS NOT NULL))'
    );
  }).then(function () {
    return db.addIndex('addresses', 'idx_addresses_user_id', ['user_id']);
  }).then(function () {
    return db.addIndex('addresses', 'idx_addresses_printer_id', ['printer_id']);
  });
};

export async function down (db) {
  return db.removeIndex('addresses', 'idx_addresses_printer_id')
    .then(function () {
      return db.removeIndex('addresses', 'idx_addresses_user_id');
    })
    .then(function () {
      return db.runSql('ALTER TABLE addresses DROP CONSTRAINT IF EXISTS check_reference');
    })
    .then(function () {
      return db.dropTable('addresses');
    });
};

export async function _meta () {
  return {
    version: 1
  }
};

