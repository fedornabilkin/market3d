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
  // Получаем ID справочников
  const regionsDict = await db.runSql(`SELECT id FROM dictionaries WHERE name = 'regions'`);
  const citiesDict = await db.runSql(`SELECT id FROM dictionaries WHERE name = 'cities'`);
  const metroDict = await db.runSql(`SELECT id FROM dictionaries WHERE name = 'metro_stations'`);
  
  const regionsId = regionsDict.rows[0].id;
  const citiesId = citiesDict.rows[0].id;
  const metroId = metroDict.rows[0].id;

  // Основные регионы России
  const regions = [
    'Москва',
    'Санкт-Петербург',
    'Московская область',
    'Ленинградская область',
    'Новосибирская область',
    'Екатеринбург',
    'Казань',
    'Нижний Новгород',
    'Челябинск',
    'Самара',
    'Омск',
    'Ростов-на-Дону',
    'Уфа',
    'Красноярск',
    'Воронеж',
    'Пермь',
    'Волгоград',
    'Краснодар',
    'Саратов',
    'Тюмень'
  ];

  // Вставляем регионы
  const regionIds = {};
  for (const region of regions) {
    const result = await db.runSql(`
      INSERT INTO dictionary_items (dictionary_id, name, created_at, updated_at)
      VALUES (${regionsId}, '${region.replace(/'/g, "''")}', NOW(), NOW())
      RETURNING id;
    `);
    regionIds[region] = result.rows[0].id;
  }

  // Города с привязкой к регионам
  const cities = [
    { name: 'Москва', parent: 'Москва' },
    { name: 'Санкт-Петербург', parent: 'Санкт-Петербург' },
    { name: 'Химки', parent: 'Московская область' },
    { name: 'Балашиха', parent: 'Московская область' },
    { name: 'Подольск', parent: 'Московская область' },
    { name: 'Королёв', parent: 'Московская область' },
    { name: 'Мытищи', parent: 'Московская область' },
    { name: 'Люберцы', parent: 'Московская область' },
    { name: 'Красногорск', parent: 'Московская область' },
    { name: 'Электросталь', parent: 'Московская область' },
    { name: 'Колпино', parent: 'Ленинградская область' },
    { name: 'Выборг', parent: 'Ленинградская область' },
    { name: 'Гатчина', parent: 'Ленинградская область' },
    { name: 'Новосибирск', parent: 'Новосибирская область' },
    { name: 'Екатеринбург', parent: 'Екатеринбург' },
    { name: 'Казань', parent: 'Казань' },
    { name: 'Нижний Новгород', parent: 'Нижний Новгород' },
    { name: 'Челябинск', parent: 'Челябинск' },
    { name: 'Самара', parent: 'Самара' },
    { name: 'Омск', parent: 'Омск' },
    { name: 'Ростов-на-Дону', parent: 'Ростов-на-Дону' },
    { name: 'Уфа', parent: 'Уфа' },
    { name: 'Красноярск', parent: 'Красноярск' },
    { name: 'Воронеж', parent: 'Воронеж' },
    { name: 'Пермь', parent: 'Пермь' },
    { name: 'Волгоград', parent: 'Волгоград' },
    { name: 'Краснодар', parent: 'Краснодар' },
    { name: 'Саратов', parent: 'Саратов' },
    { name: 'Тюмень', parent: 'Тюмень' }
  ];

  // Вставляем города
  const cityIds = {};
  for (const city of cities) {
    const parentId = regionIds[city.parent];
    if (parentId) {
      const result = await db.runSql(`
        INSERT INTO dictionary_items (dictionary_id, name, parent_id, created_at, updated_at)
        VALUES (${citiesId}, '${city.name.replace(/'/g, "''")}', ${parentId}, NOW(), NOW())
        RETURNING id;
      `);
      cityIds[city.name] = result.rows[0].id;
    }
  }

  // Станции метро Москвы
  const moscowMetro = [
    'Красные ворота', 'Комсомольская', 'Курская', 'Чистые пруды', 'Лубянка',
    'Охотный ряд', 'Библиотека имени Ленина', 'Кропоткинская', 'Парк культуры',
    'Фрунзенская', 'Спортивная', 'Лужники', 'Воробьёвы горы', 'Университет',
    'Проспект Вернадского', 'Юго-Западная', 'Тропарёво', 'Румянцево', 'Саларьево',
    'Филатов луг', 'Прокшино', 'Ольховая', 'Коммунарка', 'Сокольники',
    'Красносельская'
  ];

  // Станции метро Санкт-Петербурга
  const spbMetro = [
    'Площадь Восстания', 'Владимирская', 'Пушкинская', 'Технологический институт',
    'Балтийская', 'Нарвская', 'Кировский завод', 'Автово', 'Ленинский проспект',
    'Проспект Ветеранов', 'Парк Победы', 'Электросила', 'Московские ворота',
    'Сенная площадь', 'Невский проспект',
    'Гостиный двор', 'Василеостровская', 'Приморская', 'Чёрная речка',
    'Пионерская', 'Удельная', 'Озерки', 'Проспект Просвещения', 'Парнас'
  ];

  // Вставляем станции метро Москвы
  const moscowCityId = cityIds['Москва'];
  if (moscowCityId) {
    for (const station of moscowMetro) {
      await db.runSql(`
        INSERT INTO dictionary_items (dictionary_id, name, parent_id, created_at, updated_at)
        VALUES (${metroId}, '${station.replace(/'/g, "''")}', ${moscowCityId}, NOW(), NOW());
      `);
    }
  }

  // Вставляем станции метро Санкт-Петербурга
  const spbCityId = cityIds['Санкт-Петербург'];
  if (spbCityId) {
    for (const station of spbMetro) {
      await db.runSql(`
        INSERT INTO dictionary_items (dictionary_id, name, parent_id, created_at, updated_at)
        VALUES (${metroId}, '${station.replace(/'/g, "''")}', ${spbCityId}, NOW(), NOW());
      `);
    }
  }
}

export async function down(db) {
  // Получаем ID справочников
  const regionsDict = await db.runSql(`SELECT id FROM dictionaries WHERE name = 'regions'`);
  const citiesDict = await db.runSql(`SELECT id FROM dictionaries WHERE name = 'cities'`);
  const metroDict = await db.runSql(`SELECT id FROM dictionaries WHERE name = 'metro_stations'`);
  
  const regionsId = regionsDict.rows?.[0]?.id;
  const citiesId = citiesDict.rows?.[0]?.id;
  const metroId = metroDict.rows?.[0]?.id;

  // Удаляем в обратном порядке (сначала дочерние элементы)
  if (metroId) {
    await db.runSql(`DELETE FROM dictionary_items WHERE dictionary_id = ${metroId}`);
  }
  if (citiesId) {
    await db.runSql(`DELETE FROM dictionary_items WHERE dictionary_id = ${citiesId}`);
  }
  if (regionsId) {
    await db.runSql(`DELETE FROM dictionary_items WHERE dictionary_id = ${regionsId}`);
  }
}

export async function _meta() {
  return {
    version: 1
  };
}


