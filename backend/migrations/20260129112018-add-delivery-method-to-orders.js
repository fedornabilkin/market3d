'use strict';

var dbm;
var type;
var seed;

export async function setup(options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
}

export async function up(db) {
  return db.runSql(`
    ALTER TABLE orders 
    ADD COLUMN delivery_method_id INTEGER REFERENCES dictionary_items(id)
  `);
}

export async function down(db) {
  return db.runSql(`
    ALTER TABLE orders 
    DROP COLUMN IF EXISTS delivery_method_id
  `);
}

export async function _meta() {
  return {
    version: 1
  };
}
