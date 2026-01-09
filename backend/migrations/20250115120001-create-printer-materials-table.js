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
  return db.createTable('printer_materials', {
    id: {
      type: 'int',
      primaryKey: true,
      autoIncrement: true
    },
    printer_id: {
      type: 'int',
      notNull: true,
      foreignKey: {
        name: 'printer_materials_printer_id_fk',
        table: 'printers',
        rules: {
          onDelete: 'CASCADE',
          onUpdate: 'RESTRICT'
        },
        mapping: 'id'
      }
    },
    material_id: {
      type: 'int',
      notNull: true,
      foreignKey: {
        name: 'printer_materials_material_id_fk',
        table: 'dictionary_items',
        rules: {
          onDelete: 'CASCADE',
          onUpdate: 'RESTRICT'
        },
        mapping: 'id'
      }
    },
    created_at: {
      type: 'timestamp',
      defaultValue: new String('CURRENT_TIMESTAMP')
    }
  }).then(function () {
    // Добавляем уникальное ограничение
    return db.runSql(`
      ALTER TABLE printer_materials 
      ADD CONSTRAINT printer_materials_unique 
      UNIQUE (printer_id, material_id);
    `);
  }).then(function () {
    // Добавляем индексы
    return db.addIndex('printer_materials', 'idx_printer_materials_printer_id', ['printer_id']);
  }).then(function () {
    return db.addIndex('printer_materials', 'idx_printer_materials_material_id', ['material_id']);
  });
}

export async function down(db) {
  return db.removeIndex('printer_materials', 'idx_printer_materials_material_id').then(function () {
    return db.removeIndex('printer_materials', 'idx_printer_materials_printer_id');
  }).then(function () {
    return db.runSql(`ALTER TABLE printer_materials DROP CONSTRAINT IF EXISTS printer_materials_unique`);
  }).then(function () {
    return db.dropTable('printer_materials');
  });
}

export async function _meta() {
  return {
    version: 1
  };
}
