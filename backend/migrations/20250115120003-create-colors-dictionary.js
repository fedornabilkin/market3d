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
  // Создаем справочник "Цвета"
  const colorsResult = await db.runSql(`
    INSERT INTO dictionaries (name, description, state, created_at, updated_at)
    VALUES ('colors', 'Цвета пластика для 3D печати', 'active', NOW(), NOW())
    RETURNING id;
  `);

  const colorsId = colorsResult.rows[0].id;

  // Добавляем популярные цвета пластика
  await db.runSql(`
    INSERT INTO dictionary_items (dictionary_id, name, created_at, updated_at)
    VALUES
      (${colorsId}, 'Белый', NOW(), NOW()),
      (${colorsId}, 'Черный', NOW(), NOW()),
      (${colorsId}, 'Красный', NOW(), NOW()),
      (${colorsId}, 'Синий', NOW(), NOW()),
      (${colorsId}, 'Зеленый', NOW(), NOW()),
      (${colorsId}, 'Желтый', NOW(), NOW()),
      (${colorsId}, 'Оранжевый', NOW(), NOW()),
      (${colorsId}, 'Фиолетовый', NOW(), NOW()),
      (${colorsId}, 'Розовый', NOW(), NOW()),
      (${colorsId}, 'Серый', NOW(), NOW()),
      (${colorsId}, 'Коричневый', NOW(), NOW()),
      (${colorsId}, 'Прозрачный', NOW(), NOW()),
      (${colorsId}, 'Бежевый', NOW(), NOW()),
      (${colorsId}, 'Голубой', NOW(), NOW()),
      (${colorsId}, 'Темно-синий', NOW(), NOW()),
      (${colorsId}, 'Темно-зеленый', NOW(), NOW()),
      (${colorsId}, 'Светло-серый', NOW(), NOW()),
      (${colorsId}, 'Темно-серый', NOW(), NOW());
  `);
}

export async function down(db) {
  return db.runSql(`
    DELETE FROM dictionary_items WHERE dictionary_id IN (
      SELECT id FROM dictionaries WHERE name = 'colors'
    );
  `).then(function () {
    return db.runSql(`
      DELETE FROM dictionaries WHERE name = 'colors';
    `);
  });
}

export async function _meta() {
  return {
    version: 1
  };
}
