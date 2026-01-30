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
    ALTER TABLE printers 
    ALTER COLUMN max_size_x TYPE INTEGER USING ROUND(max_size_x)::INTEGER,
    ALTER COLUMN max_size_y TYPE INTEGER USING ROUND(max_size_y)::INTEGER,
    ALTER COLUMN max_size_z TYPE INTEGER USING ROUND(max_size_z)::INTEGER
  `);
}

export async function down(db) {
  return db.runSql(`
    ALTER TABLE printers 
    ALTER COLUMN max_size_x TYPE DECIMAL(10, 2),
    ALTER COLUMN max_size_y TYPE DECIMAL(10, 2),
    ALTER COLUMN max_size_z TYPE DECIMAL(10, 2)
  `);
}

export async function _meta() {
  return {
    version: 1
  };
}
