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
    ALTER TABLE users 
    ADD COLUMN last_activity_at TIMESTAMP
  `);
}

export async function down(db) {
  return db.runSql(`
    ALTER TABLE users 
    DROP COLUMN IF EXISTS last_activity_at
  `);
}

export async function _meta() {
  return {
    version: 1
  };
}
