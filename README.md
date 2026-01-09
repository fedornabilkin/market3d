# 3D Marketplace

Маркетплейс для заказа 3D печати с регистрацией владельцев 3D-принтеров.

## Технологии

- **Backend**: Express.js, PostgreSQL, Passport.js (Local + JWT)
- **Frontend**: Vue 3, TypeScript, Element Plus, Pug
- **База данных**: PostgreSQL

## Архитектура базы данных

### Основные таблицы:
- `users` - пользователи системы (с солью для паролей)
- `addresses` - адреса пользователей и принтеров (с координатами)
- `printers` - 3D-принтеры
- `orders` - заказы на печать (без привязки к конкретному принтеру)
- `order_files` - файлы заказов
- `order_messages` - сообщения по заказам

### Ключевые особенности:
- Универсальное поле `user_id` в таблицах принтеров и заказов
- Отдельная таблица адресов с поддержкой геолокации
- Заказы не привязаны к конкретному принтеру (гибкая система)
- Использование `state` вместо `status`
- Соль для безопасного хеширования паролей

## Установка

### Backend

1. Перейдите в директорию `backend`:
```bash
cd backend
```

2. Установите зависимости:
```bash
npm install
```

3. Создайте файл `.env`:
```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=marketplace
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d
UPLOAD_DIR=./uploads
```

4. Создайте базу данных PostgreSQL и выполните схему:
```bash
# Создайте базу данных
createdb marketplace

# Выполните схему
psql -U postgres -d marketplace -f database/schema.sql

# Если обновляете существующую БД, используйте миграцию:
psql -U postgres -d marketplace -f database/migration_refactor_schema.sql
```

5. Запустите сервер:
```bash
npm start
# или для разработки:
npm run dev
```

### Frontend

1. Перейдите в директорию `frontend`:
```bash
cd frontend
```

2. Установите зависимости:
```bash
npm install
```

3. Запустите dev сервер:
```bash
npm run dev
```

Приложение будет доступно по адресу: http://localhost:5273

## API Endpoints

### Аутентификация
- `POST /api/auth/register` - регистрация
- `POST /api/auth/login` - вход
- `GET /api/auth/profile` - текущий пользователь

### Принтеры
- `GET /api/printers` - список принтеров
- `GET /api/printers/:id` - детали принтера
- `POST /api/printers` - создать принтер
- `PUT /api/printers/:id` - обновить принтер
- `DELETE /api/printers/:id` - удалить принтер

### Заказы
- `GET /api/orders` - список заказов
- `GET /api/orders/:id` - детали заказа
- `POST /api/orders` - создать заказ (черновик)
- `PUT /api/orders/:id` - обновить заказ
- `POST /api/orders/:id/submit` - отправить черновик в работу
- `PUT /api/orders/:id/state` - изменить состояние заказа

### Файлы заказов
- `POST /api/orders/:orderId/files` - загрузить файлы
- `GET /api/orders/:orderId/files` - получить список файлов
- `DELETE /api/orders/:orderId/files/:fileId` - удалить файл

### Сообщения
- `GET /api/orders/:orderId/messages` - получить сообщения
- `POST /api/orders/:orderId/messages` - отправить сообщение

### Адреса
- `GET /api/addresses/user/:userId` - адреса пользователя
- `GET /api/addresses/printer/:printerId` - адреса принтера
- `POST /api/addresses` - создать адрес
- `PUT /api/addresses/:id` - обновить адрес
- `DELETE /api/addresses/:id` - удалить адрес

## Процесс работы с заказом

1. **Создание черновика**: `POST /api/orders` — создается заказ в состоянии `draft`
2. **Добавление файлов**: `POST /api/orders/:orderId/files` — загрузка 3D моделей
3. **Редактирование**: `PUT /api/orders/:id` — изменение параметров заказа
4. **Отправка в работу**: `POST /api/orders/:id/submit` — меняет состояние с `draft` на `pending`

## Состояния (States)

### Принтеры:
- `available` - доступен
- `busy` - занят
- `maintenance` - на обслуживании
- `inactive` - неактивен

### Заказы:
- `draft` - черновик
- `pending` - ожидает одобрения
- `approved` - одобрен
- `in_progress` - в работе
- `completed` - завершен
- `cancelled` - отменен

## Разработка

### Backend
- Node.js 20.19+ или 22.12+
- PostgreSQL 14+
- Express.js 4.x

### Frontend
- Vue 3 с Composition API
- TypeScript 5.x
- Element Plus для UI компонентов
- Pug для шаблонов
- Vite 7.x для сборки
