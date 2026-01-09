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
  // Добавляем поле parent_id в таблицу dictionary_items
  return db.addColumn('dictionary_items', 'parent_id', {
    type: 'int',
    notNull: false
  }).then(function () {
    // Добавляем внешний ключ на саму таблицу dictionary_items
    return db.runSql(`
      ALTER TABLE dictionary_items 
      ADD CONSTRAINT dictionary_items_parent_id_fk 
      FOREIGN KEY (parent_id) 
      REFERENCES dictionary_items(id) 
      ON DELETE CASCADE;
    `);
  }).then(function () {
    // Добавляем индекс для оптимизации запросов
    return db.addIndex('dictionary_items', 'idx_dictionary_items_parent_id', ['parent_id']);
  });
}

export async function down(db) {
  return db.removeIndex('dictionary_items', 'idx_dictionary_items_parent_id').then(function () {
    return db.runSql(`
      ALTER TABLE dictionary_items 
      DROP CONSTRAINT IF EXISTS dictionary_items_parent_id_fk;
    `);
  }).then(function () {
    return db.removeColumn('dictionary_items', 'parent_id');
  });
}

export async function _meta() {
  return {
    version: 1
  };
}


