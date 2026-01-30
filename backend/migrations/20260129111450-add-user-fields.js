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
    ADD COLUMN name VARCHAR(255),
    ADD COLUMN description TEXT,
    ADD COLUMN avatar_url VARCHAR(500)
  `);
}

export async function down(db) {
  return db.runSql(`
    ALTER TABLE users 
    DROP COLUMN IF EXISTS name,
    DROP COLUMN IF EXISTS description,
    DROP COLUMN IF EXISTS avatar_url
  `);
}

export async function _meta() {
  return {
    version: 1
  };
}
