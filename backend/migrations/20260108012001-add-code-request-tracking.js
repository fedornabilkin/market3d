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
  const col = await db.runSql(`
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'last_code_request_at';
  `);
  if (col?.rows?.length) return;

  return db.addColumn('users', 'last_code_request_at', {
    type: 'timestamp'
  });
}

export async function down(db) {
  return db.removeColumn('users', 'last_code_request_at');
}

export async function _meta() {
  return {
    version: 1
  };
}

