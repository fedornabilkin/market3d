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
    ADD COLUMN max_size_x DECIMAL(10, 2),
    ADD COLUMN max_size_y DECIMAL(10, 2),
    ADD COLUMN max_size_z DECIMAL(10, 2),
    ADD COLUMN description TEXT,
    ADD COLUMN quantity INTEGER DEFAULT 1
  `).then(function() {
    return db.runSql(`
      UPDATE printers 
      SET max_size_x = 0, max_size_y = 0, max_size_z = 0 
      WHERE max_size_x IS NULL
    `);
  }).then(function() {
    return db.runSql(`
      ALTER TABLE printers 
      ALTER COLUMN max_size_x SET NOT NULL,
      ALTER COLUMN max_size_y SET NOT NULL,
      ALTER COLUMN max_size_z SET NOT NULL
    `);
  });
}

export async function down(db) {
  return db.runSql(`
    ALTER TABLE printers 
    DROP COLUMN IF EXISTS max_size_x,
    DROP COLUMN IF EXISTS max_size_y,
    DROP COLUMN IF EXISTS max_size_z,
    DROP COLUMN IF EXISTS description,
    DROP COLUMN IF EXISTS quantity
  `);
}

export async function _meta() {
  return {
    version: 1
  };
}
