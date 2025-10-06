# 🚀 Quick Start Guide - MongoDB & Logging

## ✅ Що було зроблено

### 💾 MongoDB Integration
- ✅ Mongoose схеми: Stream, User, Recording
- ✅ Автоматичні індекси для швидкого пошуку
- ✅ Методи: create, update, delete, find
- ✅ Підтримка локальної та cloud БД

### 📝 Enhanced Logging
- ✅ Winston з daily rotation
- ✅ Кольорові логи з емодзі (🚀 ✅ ❌ ⚠️)
- ✅ Окремі файли: RTMP, WebSocket, Errors
- ✅ JSON формат для аналізу

---

## 📦 Нові пакети

```json
{
  "mongoose": "^8.0.0",
  "@types/mongoose": "^5.11.97",
  "winston-daily-rotate-file": "^5.0.0",
  "dotenv": "^16.3.1"
}
```

---

## 🛠️ Налаштування (2 хвилини)

### Крок 1: Встановіть MongoDB

**Локально (рекомендовано для розробки):**

```powershell
# Завантажте MongoDB Community Server
# https://www.mongodb.com/try/download/community

# Встановіть та запустіть
net start MongoDB

# Перевірка
mongod --version
```

**Або Atlas (Cloud - безкоштовно):**

1. Зареєструйтесь: https://www.mongodb.com/cloud/atlas
2. Створіть FREE кластер
3. Скопіюйте connection string

---

### Крок 2: Налаштуйте `.env`

Файл `.env` вже створено:

```env
# Локальна база (за замовчуванням)
MONGODB_URI=mongodb://localhost:27017/capturestream

# Або Atlas (cloud)
# MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/capturestream

PORT=3001
LOG_LEVEL=info
NODE_ENV=development
```

---

### Крок 3: Встановіть залежності

```powershell
npm install
```

---

### Крок 4: Скомпілюйте код

```powershell
npm run build
```

---

### Крок 5: Запустіть проект

```powershell
npm run start:all
```

Ви побачите:
```
🚀 Starting CaptureStream Server
✅ MongoDB connected successfully
  database: capturestream
  host: localhost
  port: 27017
📡 RTMP SERVER v1.0
🌐 WebSocket Server running on port 3001
```

---

## 📊 Перевірка роботи

### 1. Перевірте підключення до БД:

```powershell
# Відкрийте MongoDB shell
mongosh

# Використовуйте базу
use capturestream

# Перегляньте колекції
show collections
```

### 2. Перевірте логи:

```powershell
# Real-time логи
Get-Content logs\combined-2024-10-06.log -Wait -Tail 50

# Помилки
Get-Content logs\error-2024-10-06.log -Wait
```

### 3. Перевірте веб-інтерфейс:

```
http://localhost:3001
```

---

## 🎯 Використання

### Створення стріму:

1. Відкрийте http://localhost:3001/studio.html
2. Натисніть "Запустити трансляцію"
3. Стрім автоматично збережеться в MongoDB

### Перегляд стрімів:

```typescript
// В консолі MongoDB
db.streams.find({ status: 'live' }).pretty()
```

### Логування:

```typescript
import { log } from './logger';

// В коді
log.streamStart('Stream started', {
  streamId: 'abc123',
  title: 'My Stream',
  quality: '1080p'
});
```

---

## 📂 Структура логів

```
logs/
├── combined-2024-10-06.log       # Всі події (ротація щодня)
├── error-2024-10-06.log          # Помилки (30 днів)
├── rtmp-2024-10-06.log           # RTMP події (7 днів)
├── websocket-2024-10-06.log      # WebSocket події (7 днів)
├── debug-2024-10-06.log          # Debug (dev only)
├── exceptions.log                # Критичні помилки
└── rejections.log                # Promise rejections
```

---

## 🗄️ MongoDB Колекції

### streams
```javascript
{
  streamId: "abc123",
  title: "My Stream",
  streamer: {
    id: "user1",
    username: "john_doe"
  },
  status: "live",
  viewers: 5,
  peakViewers: 10,
  startTime: ISODate("2024-10-06T14:30:00Z"),
  quality: {
    resolution: "1920x1080",
    fps: 30,
    bitrate: 2500
  }
}
```

### users
```javascript
{
  userId: "user1",
  username: "john_doe",
  email: "john@example.com",
  role: "streamer",
  stats: {
    totalStreams: 10,
    totalViews: 1000,
    followers: 50
  }
}
```

### recordings
```javascript
{
  recordingId: "rec1",
  streamId: "abc123",
  title: "Stream Recording",
  filePath: "/media/recordings/abc123.mp4",
  fileSize: 104857600,
  duration: 3600,
  status: "ready"
}
```

---

## 🔍 Корисні команди

### MongoDB:

```javascript
// Підрахунок стрімів
db.streams.countDocuments()

// Активні стріми
db.streams.find({ status: 'live' })

// Топ стримерів
db.streams.aggregate([
  { $group: {
    _id: "$streamer.username",
    totalStreams: { $sum: 1 },
    totalViews: { $sum: "$stats.totalViews" }
  }},
  { $sort: { totalViews: -1 }},
  { $limit: 10 }
])

// Очистка тестових даних
db.streams.deleteMany({})
```

### Логи:

```powershell
# Пошук помилок
Select-String -Path "logs\error-*.log" -Pattern "error"

# Фільтрація за часом
Select-String -Path "logs\combined-*.log" -Pattern "14:30"

# Підрахунок помилок
(Select-String -Path "logs\error-*.log" -Pattern "error").Count

# Останні 100 рядків
Get-Content logs\combined-2024-10-06.log -Tail 100
```

---

## 🐛 Troubleshooting

### MongoDB не запускається:

```powershell
# Перевірка служби
Get-Service MongoDB

# Запуск вручну
net start MongoDB

# Перегляд логів MongoDB
Get-Content "C:\Program Files\MongoDB\Server\7.0\log\mongod.log" -Tail 50
```

### Помилка підключення:

```
Error: connect ECONNREFUSED 127.0.0.1:27017
```

**Рішення:**
1. Переконайтесь що MongoDB запущений
2. Перевірте `.env` - правильний MONGODB_URI
3. Перевірте firewall

### Логи не створюються:

```powershell
# Створіть папку вручну
New-Item -ItemType Directory -Path "logs" -Force

# Перевірте права
icacls logs
```

---

## 📚 Детальна документація

- **[MONGODB-SETUP.md](./MONGODB-SETUP.md)** - Встановлення MongoDB (локально/Atlas)
- **[LOGGING-GUIDE.md](./LOGGING-GUIDE.md)** - Повний гайд з логування
- **[DATABASE-CHANGELOG.md](./DATABASE-CHANGELOG.md)** - Що змінилось в БД
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Архітектура системи

---

## 🎯 Next Steps

1. ✅ Встановіть MongoDB
2. ✅ Налаштуйте `.env`
3. ✅ Запустіть проект
4. ✅ Перевірте логи
5. ✅ Створіть тестовий стрім

---

## 💡 Tips

### Development:
```env
NODE_ENV=development
LOG_LEVEL=debug
```

### Production:
```env
NODE_ENV=production
LOG_LEVEL=info
MONGODB_URI=mongodb+srv://...  # Atlas
```

### Debug:
```powershell
# Детальні логи
$env:LOG_LEVEL="debug"
npm run start:all
```

---

## ✅ Checklist

- [ ] MongoDB встановлено
- [ ] MongoDB запущений (net start MongoDB)
- [ ] .env налаштований
- [ ] npm install виконано
- [ ] npm run build успішний
- [ ] npm run start:all працює
- [ ] Логи створюються в папці logs/
- [ ] Стріми зберігаються в MongoDB
- [ ] Веб-інтерфейс доступний

---

**Готово! База даних та логування налаштовані! 🎉**

*Наступний крок: Запустіть проект командою `npm run start:all`*
