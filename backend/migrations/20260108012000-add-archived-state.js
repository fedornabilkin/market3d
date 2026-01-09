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
  // Добавляем состояние 'archived' в таблицу printers
  return db.runSql(`
    ALTER TABLE printers DROP CONSTRAINT IF EXISTS printers_state_check;
  `).then(function () {
    return db.runSql(`
      ALTER TABLE printers ADD CONSTRAINT printers_state_check 
      CHECK (state IN ('available', 'busy', 'maintenance', 'inactive', 'archived'));
    `);
  }).then(function () {
    // Добавляем состояние 'archived' в таблицу orders
    return db.runSql(`
      ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_state_check;
    `);
  }).then(function () {
    return db.runSql(`
      ALTER TABLE orders ADD CONSTRAINT orders_state_check 
      CHECK (state IN ('draft', 'pending', 'approved', 'in_progress', 'completed', 'cancelled', 'archived'));
    `);
  });
}

export async function down(db) {
  // Откатываем изменения для printers
  return db.runSql(`
    ALTER TABLE printers DROP CONSTRAINT IF EXISTS printers_state_check;
  `).then(function () {
    return db.runSql(`
      ALTER TABLE printers ADD CONSTRAINT printers_state_check 
      CHECK (state IN ('available', 'busy', 'maintenance', 'inactive'));
    `);
  }).then(function () {
    // Откатываем изменения для orders
    return db.runSql(`
      ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_state_check;
    `);
  }).then(function () {
    return db.runSql(`
      ALTER TABLE orders ADD CONSTRAINT orders_state_check 
      CHECK (state IN ('draft', 'pending', 'approved', 'in_progress', 'completed', 'cancelled'));
    `);
  });
}

export async function _meta() {
  return {
    version: 1
  };
}

