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
  // Создаем справочник "Материалы"
  const materialsResult = await db.runSql(`
    INSERT INTO dictionaries (name, description, state, created_at, updated_at)
    VALUES ('materials', 'Материалы для 3D печати', 'active', NOW(), NOW())
    RETURNING id;
  `);

  const materialsId = materialsResult.rows[0].id;

  // Добавляем элементы справочника "Материалы"
  await db.runSql(`
    INSERT INTO dictionary_items (dictionary_id, name, created_at, updated_at)
    VALUES
      (${materialsId}, 'PLA', NOW(), NOW()),
      (${materialsId}, 'ABS', NOW(), NOW()),
      (${materialsId}, 'PETG', NOW(), NOW()),
      (${materialsId}, 'TPU', NOW(), NOW()),
      (${materialsId}, 'NYLON', NOW(), NOW());
  `);

  // Создаем справочник "Производители принтеров"
  const manufacturersResult = await db.runSql(`
    INSERT INTO dictionaries (name, description, state, created_at, updated_at)
    VALUES ('printer_manufacturers', 'Производители 3D принтеров', 'active', NOW(), NOW())
    RETURNING id;
  `);
  const manufacturersId = manufacturersResult.rows[0].id;

  // Добавляем элементы справочника "Производители"
  await db.runSql(`
    INSERT INTO dictionary_items (dictionary_id, name, created_at, updated_at)
    VALUES
      (${manufacturersId}, 'Creality', NOW(), NOW()),
      (${manufacturersId}, 'Prusa Research', NOW(), NOW()),
      (${manufacturersId}, 'Ultimaker', NOW(), NOW()),
      (${manufacturersId}, 'Formlabs', NOW(), NOW()),
      (${manufacturersId}, 'Anycubic', NOW(), NOW()),
      (${manufacturersId}, 'Ender', NOW(), NOW()),
      (${manufacturersId}, 'FlashForge', NOW(), NOW()),
      (${manufacturersId}, 'Artillery', NOW(), NOW());
  `);

  // Создаем справочник "Модели принтеров"
  const modelsResult = await db.runSql(`
    INSERT INTO dictionaries (name, description, state, created_at, updated_at)
    VALUES ('printer_models', 'Модели 3D принтеров', 'active', NOW(), NOW())
    RETURNING id;
  `);
  const modelsId = modelsResult.rows[0].id;

  // Добавляем элементы справочника "Модели" (с привязкой к производителям через дополнительное поле или через название)
  // Для упрощения будем хранить модели как "Производитель Модель"
  await db.runSql(`
    INSERT INTO dictionary_items (dictionary_id, name, created_at, updated_at)
    VALUES
      (${modelsId}, 'Creality Ender 3', NOW(), NOW()),
      (${modelsId}, 'Creality Ender 3 V2', NOW(), NOW()),
      (${modelsId}, 'Creality CR-10', NOW(), NOW()),
      (${modelsId}, 'Prusa i3 MK3S+', NOW(), NOW()),
      (${modelsId}, 'Prusa MINI+', NOW(), NOW()),
      (${modelsId}, 'Ultimaker S3', NOW(), NOW()),
      (${modelsId}, 'Ultimaker S5', NOW(), NOW()),
      (${modelsId}, 'Formlabs Form 3', NOW(), NOW()),
      (${modelsId}, 'Anycubic Kobra', NOW(), NOW()),
      (${modelsId}, 'Anycubic Photon', NOW(), NOW()),
      (${modelsId}, 'FlashForge Creator Pro', NOW(), NOW()),
      (${modelsId}, 'FlashForge AD5X', NOW(), NOW()),
      (${modelsId}, 'Artillery Sidewinder X1', NOW(), NOW());
  `);
}

export async function down(db) {
  return db.runSql(`
    DELETE FROM dictionary_items WHERE dictionary_id IN (
      SELECT id FROM dictionaries WHERE name IN ('materials', 'printer_manufacturers', 'printer_models')
    );
  `).then(function () {
    return db.runSql(`
      DELETE FROM dictionaries WHERE name IN ('materials', 'printer_manufacturers', 'printer_models');
    `);
  });
}

export async function _meta() {
  return {
    version: 1
  };
}

