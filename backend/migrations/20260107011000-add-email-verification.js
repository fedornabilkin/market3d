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
  return db.addColumn('users', 'email_verification_code', {
    type: 'string',
    length: 4
  }).then(function () {
    return db.addColumn('users', 'email_verified', {
      type: 'boolean',
      defaultValue: false
    });
  }).then(function () {
    return db.addColumn('users', 'email_verification_code_expires_at', {
      type: 'timestamp'
    });
  }).then(function () {
    return db.addColumn('users', 'new_email', {
      type: 'string',
      length: 255
    });
  }).then(function () {
    return db.addColumn('users', 'new_email_verification_code', {
      type: 'string',
      length: 4
    });
  });
}

export async function down(db) {
  return db.removeColumn('users', 'new_email_verification_code')
    .then(function () {
      return db.removeColumn('users', 'new_email');
    })
    .then(function () {
      return db.removeColumn('users', 'email_verification_code_expires_at');
    })
    .then(function () {
      return db.removeColumn('users', 'email_verified');
    })
    .then(function () {
      return db.removeColumn('users', 'email_verification_code');
    });
}

export async function _meta() {
  return {
    version: 1
  };
}

