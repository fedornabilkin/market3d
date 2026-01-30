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
    ALTER COLUMN material DROP NOT NULL
  `);
}

export async function down(db) {
  return db.runSql(`
    ALTER TABLE orders 
    ALTER COLUMN material SET NOT NULL
  `);
}

export async function _meta() {
  return {
    version: 1
  };
}
