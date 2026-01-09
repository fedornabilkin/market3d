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
  return db.createTable('orders', {
    id: {
      type: 'int',
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: 'int',
      notNull: true,
      foreignKey: {
        name: 'orders_user_id_fk',
        table: 'users',
        rules: {
          onDelete: 'CASCADE'
        },
        mapping: 'id'
      }
    },
    model_file_url: {
      type: 'string',
      length: 500
    },
    material: {
      type: 'string',
      length: 100,
      notNull: true
    },
    color: {
      type: 'string',
      length: 50
    },
    quantity: {
      type: 'int',
      notNull: true
    },
    dimensions: {
      type: 'jsonb',
      defaultValue: new String("'{}'")
    },
    deadline: {
      type: 'timestamp',
      notNull: true
    },
    description: {
      type: 'text',
      defaultValue: ''
    },
    state: {
      type: 'string',
      length: 20,
      defaultValue: 'draft'
    },
    total_price: {
      type: 'decimal',
      precision: 10,
      scale: 2,
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
    return db.runSql(
      "ALTER TABLE orders ADD CONSTRAINT orders_quantity_check CHECK (quantity > 0)"
    );
  }).then(function () {
    return db.runSql(
      "ALTER TABLE orders ADD CONSTRAINT orders_state_check CHECK (state IN ('draft', 'pending', 'approved', 'in_progress', 'completed', 'cancelled'))"
    );
  }).then(function () {
    return db.addIndex('orders', 'idx_orders_user_id', ['user_id']);
  }).then(function () {
    return db.addIndex('orders', 'idx_orders_state', ['state']);
  });
};

export async function down (db) {
  return db.removeIndex('orders', 'idx_orders_state')
    .then(function () {
      return db.removeIndex('orders', 'idx_orders_user_id');
    })
    .then(function () {
      return db.runSql('ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_state_check');
    })
    .then(function () {
      return db.runSql('ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_quantity_check');
    })
    .then(function () {
      return db.dropTable('orders');
    });
};

export async function _meta () {
  return {
    version: 1
  }
};

