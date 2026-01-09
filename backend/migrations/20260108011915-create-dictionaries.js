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
  return db.createTable('dictionaries', {
    id: {
      type: 'int',
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: 'string',
      length: 255,
      notNull: true,
      unique: true
    },
    description: {
      type: 'text'
    },
    state: {
      type: 'string',
      length: 20,
      defaultValue: 'active'
    },
    created_at: {
      type: 'timestamp',
      defaultValue: new String('CURRENT_TIMESTAMP')
    },
    updated_at: {
      type: 'timestamp',
      defaultValue: new String('CURRENT_TIMESTAMP')
    }
  }).then(function () {
    return db.addIndex('dictionaries', 'idx_dictionaries_name', ['name'], true);
  }).then(function () {
    return db.addIndex('dictionaries', 'idx_dictionaries_state', ['state']);
  }).then(function () {
    return db.createTable('dictionary_items', {
      id: {
        type: 'int',
        primaryKey: true,
        autoIncrement: true
      },
      dictionary_id: {
        type: 'int',
        notNull: true,
        foreignKey: {
          name: 'dictionary_items_dictionary_id_fk',
          table: 'dictionaries',
          rules: {
            onDelete: 'CASCADE',
            onUpdate: 'RESTRICT'
          },
          mapping: 'id'
        }
      },
      name: {
        type: 'string',
        length: 255,
        notNull: true
      },
      created_at: {
        type: 'timestamp',
        defaultValue: new String('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: 'timestamp',
        defaultValue: new String('CURRENT_TIMESTAMP')
      }
    });
  }).then(function () {
    return db.runSql(`
      ALTER TABLE dictionary_items ADD CONSTRAINT dictionary_items_unique_name 
      UNIQUE (dictionary_id, name);
    `);
  }).then(function () {
    return db.addIndex('dictionary_items', 'idx_dictionary_items_dictionary_id', ['dictionary_id']);
  });
}

export async function down(db) {
  return db.removeIndex('dictionary_items', 'idx_dictionary_items_dictionary_id').then(function () {
    return db.removeIndex('dictionary_items', 'idx_dictionary_items_unique_name').then(function () {
      return db.dropTable('dictionary_items');
    });
  }).then(function () {
    return db.removeIndex('dictionaries', 'idx_dictionaries_name').then(function () {
      return db.removeIndex('dictionaries', 'idx_dictionaries_state').then(function () {
        return db.dropTable('dictionaries');
      });
    });
  });
}

export async function _meta() {
  return {
    version: 1
  };
}

