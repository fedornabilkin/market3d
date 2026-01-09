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
  // Создаем справочник "Регионы"
  const regionsResult = await db.runSql(`
    INSERT INTO dictionaries (name, description, state, created_at, updated_at)
    VALUES ('regions', 'Регионы России', 'active', NOW(), NOW())
    RETURNING id;
  `);
  const regionsId = regionsResult.rows[0].id;

  // Создаем справочник "Города"
  const citiesResult = await db.runSql(`
    INSERT INTO dictionaries (name, description, state, created_at, updated_at)
    VALUES ('cities', 'Города России', 'active', NOW(), NOW())
    RETURNING id;
  `);
  const citiesId = citiesResult.rows[0].id;

  // Создаем справочник "Станции метро"
  const metroResult = await db.runSql(`
    INSERT INTO dictionaries (name, description, state, created_at, updated_at)
    VALUES ('metro_stations', 'Станции метро', 'active', NOW(), NOW())
    RETURNING id;
  `);
  const metroId = metroResult.rows[0].id;

  return { regionsId, citiesId, metroId };
}

export async function down(db) {
  return db.runSql(`
    DELETE FROM dictionary_items WHERE dictionary_id IN (
      SELECT id FROM dictionaries WHERE name IN ('regions', 'cities', 'metro_stations')
    );
  `).then(function () {
    return db.runSql(`
      DELETE FROM dictionaries WHERE name IN ('regions', 'cities', 'metro_stations');
    `);
  });
}

export async function _meta() {
  return {
    version: 1
  };
}


