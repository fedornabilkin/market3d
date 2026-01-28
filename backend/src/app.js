// src/app.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import passport from './middleware/auth.js';
import { applyMigrations, testConnection } from './services/migrate.js';

import authRoutes from './routes/auth.js';
import printerRoutes from './routes/printers.js';
import orderRoutes from './routes/orders.js';
import messageRoutes from './routes/messages.js';
import addressRoutes from './routes/addresses.js';
import statsRoutes from './routes/stats.js';
import dictionaryRoutes from './routes/dictionaries.js';
import clusterRoutes from './routes/clusters.js';
import clusterPrinterRoutes from './routes/clusterPrinters.js';
import clusterPrinterRequestRoutes from './routes/clusterPrinterRequests.js';
import notificationRoutes from './routes/notifications.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/printers', printerRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/messages', messageRoutes); // ← исправлен конфликт роутов
app.use('/api/addresses', addressRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/dictionaries', dictionaryRoutes);
app.use('/api/clusters', clusterRoutes);
app.use('/api/clusters', clusterPrinterRoutes);
app.use('/api/clusters', clusterPrinterRequestRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large' });
    }
  }
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

async function startApp() {
  try {
    console.log('🚀 Starting 3D Marketplace...');
    
    // 1. Тест подключения к БД
    await testConnection();
    console.log('✅ Database connected');

    // 2. Применяем миграции (только новые)
    await applyMigrations();

    // 3. Запускаем сервер
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running: http://localhost:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('💥 Startup failed:', error);
    process.exit(1);
  }
}

startApp();
