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
  // Добавляем колонку color_id
  return db.addColumn('orders', 'color_id', {
    type: 'int',
    notNull: false,
    foreignKey: {
      name: 'orders_color_id_fk',
      table: 'dictionary_items',
      rules: {
        onDelete: 'SET NULL',
        onUpdate: 'RESTRICT'
      },
      mapping: 'id'
    }
  }).then(function () {
    // Добавляем индекс
    return db.addIndex('orders', 'idx_orders_color_id', ['color_id']);
  });
}

export async function down(db) {
  return db.removeIndex('orders', 'idx_orders_color_id').then(function () {
    return db.removeColumn('orders', 'color_id');
  });
}

export async function _meta() {
  return {
    version: 1
  };
}
