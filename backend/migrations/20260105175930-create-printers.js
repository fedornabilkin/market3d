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
  return db.createTable('printers', {
    id: {
      type: 'int',
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: 'int',
      notNull: true,
      foreignKey: {
        name: 'printers_user_id_fk',
        table: 'users',
        rules: {
          onDelete: 'CASCADE'
        },
        mapping: 'id'
      }
    },
    model_name: {
      type: 'string',
      length: 255,
      notNull: true
    },
    manufacturer: {
      type: 'string',
      length: 255,
      notNull: true
    },
    specifications: {
      type: 'jsonb',
      defaultValue: new String("'{}'")
    },
    price_per_hour: {
      type: 'decimal',
      precision: 10,
      scale: 2,
      notNull: true
    },
    max_build_volume: {
      type: 'jsonb',
      defaultValue: new String("'{}'")
    },
    materials: {
      type: 'jsonb',
      defaultValue: new String("'[]'")
    },
    state: {
      type: 'string',
      length: 20,
      defaultValue: 'available'
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
      "ALTER TABLE printers ADD CONSTRAINT printers_state_check CHECK (state IN ('available', 'busy', 'maintenance', 'inactive'))"
    );
  }).then(function () {
    return db.addIndex('printers', 'idx_printers_user_id', ['user_id']);
  }).then(function () {
    return db.addIndex('printers', 'idx_printers_state', ['state']);
  });
};

export async function down (db) {
  return db.removeIndex('printers', 'idx_printers_state')
    .then(function () {
      return db.removeIndex('printers', 'idx_printers_user_id');
    })
    .then(function () {
      return db.runSql('ALTER TABLE printers DROP CONSTRAINT IF EXISTS printers_state_check');
    })
    .then(function () {
      return db.dropTable('printers');
    });
};

export async function _meta () {
  return {
    version: 1
  }
};

