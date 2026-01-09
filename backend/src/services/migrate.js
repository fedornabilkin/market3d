// src/services/migrate.js
import DbMigrate from 'db-migrate';
import pool from '../config/database.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Тест подключения
export async function testConnection() {
  const client = await pool.connect();
  await client.query('SELECT 1');
  await client.release();
}

export async function applyMigrations() {
  let migrator = null;

  try {
    console.log('🔄 Applying migrations...');

    const migrationsDir = path.resolve(__dirname, '../../migrations');
    console.log('Migrations path:', migrationsDir);
    
    // УБИРАЕМ проблемную строку с migrator.pending()
    migrator = await DbMigrate.getInstance(true, {
      env: process.env.NODE_ENV || 'development',
      dir: migrationsDir
    });

    // db-migrate САМ проверяет статус и применяет только новые миграции
    await migrator.up();
    console.log('✅ All migrations applied');
    
  } catch (error) {
    // Обрабатываем типичные "безобидные" ошибки
    if (error.message.includes('No migrations') || 
        error.message.includes('already at latest') ||
        error.message.includes('No pending migrations')) {
      console.log('ℹ️ Database up to date');
    } else {
      console.error('❌ Migration failed:', error.message);
      throw error;
    }
  } finally {
    
  }
}
