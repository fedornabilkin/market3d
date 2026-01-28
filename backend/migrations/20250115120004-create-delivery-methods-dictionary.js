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
  // Создаем справочник "Способы доставки"
  const deliveryResult = await db.runSql(`
    INSERT INTO dictionaries (name, description, state, created_at, updated_at)
    VALUES ('delivery_methods', 'Способы доставки', 'active', NOW(), NOW())
    RETURNING id;
  `);

  const deliveryId = deliveryResult.rows[0].id;

  // Добавляем популярных доставщиков
  await db.runSql(`
    INSERT INTO dictionary_items (dictionary_id, name, created_at, updated_at)
    VALUES
      (${deliveryId}, 'СДЭК', NOW(), NOW()),
      (${deliveryId}, 'Почта России', NOW(), NOW()),
      (${deliveryId}, 'Boxberry', NOW(), NOW()),
      (${deliveryId}, 'DPD', NOW(), NOW()),
      (${deliveryId}, 'Яндекс.Доставка', NOW(), NOW()),
      (${deliveryId}, 'PickPoint', NOW(), NOW()),
      (${deliveryId}, 'EMS', NOW(), NOW()),
      (${deliveryId}, 'Деловые Линии', NOW(), NOW()),
      (${deliveryId}, 'ПЭК', NOW(), NOW()),
      (${deliveryId}, 'Самовывоз', NOW(), NOW());
  `);
}

export async function down(db) {
  return db.runSql(`
    DELETE FROM dictionary_items WHERE dictionary_id IN (
      SELECT id FROM dictionaries WHERE name = 'delivery_methods'
    );
  `).then(function () {
    return db.runSql(`
      DELETE FROM dictionaries WHERE name = 'delivery_methods';
    `);
  });
}

export async function _meta() {
  return {
    version: 1
  };
}
