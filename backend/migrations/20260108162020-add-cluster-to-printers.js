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
  // Добавляем поле cluster_id в таблицу printers
  return db.addColumn('printers', 'cluster_id', {
    type: 'int',
    notNull: false
  }).then(function () {
    // Добавляем внешний ключ
    return db.runSql(`
      ALTER TABLE printers 
      ADD CONSTRAINT printers_cluster_id_fk 
      FOREIGN KEY (cluster_id) 
      REFERENCES clusters(id) 
      ON DELETE SET NULL;
    `);
  }).then(function () {
    // Добавляем индекс для оптимизации запросов
    return db.addIndex('printers', 'idx_printers_cluster_id', ['cluster_id']);
  });
}

export async function down(db) {
  return db.removeIndex('printers', 'idx_printers_cluster_id').then(function () {
    return db.runSql(`
      ALTER TABLE printers 
      DROP CONSTRAINT IF EXISTS printers_cluster_id_fk;
    `);
  }).then(function () {
    return db.removeColumn('printers', 'cluster_id');
  });
}

export async function _meta() {
  return {
    version: 1
  };
}


