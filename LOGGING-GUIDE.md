# 📝 Logging System Guide

## 🎯 Огляд системи логування

Проект використовує **Winston** з розширеним функціоналом:
- ✅ Ротація файлів щодня
- ✅ Різні рівні логування (error, warn, info, debug)
- ✅ Кольорові логи в консолі з емодзі
- ✅ JSON формат для машинного читання
- ✅ Окремі логи для RTMP, WebSocket, помилок

---

## 📂 Структура логів

```
logs/
├── combined-2024-10-06.log       # Всі логи (щоденна ротація)
├── error-2024-10-06.log          # Тільки помилки (30 днів)
├── debug-2024-10-06.log          # Debug режим (7 днів)
├── rtmp-2024-10-06.log           # RTMP події
├── websocket-2024-10-06.log      # WebSocket події
├── exceptions.log                # Необроблені виключення
└── rejections.log                # Promise rejections
```

---

## 🔧 Використання

### Базове логування:

```typescript
import { logger, log } from './logger';

// Стандартні методи Winston
logger.info('Server started');
logger.error('Something went wrong', { error });
logger.debug('Debug information');
logger.warn('Warning message');

// Розширені методи з емодзі
log.success('Operation completed');
log.error('Failed to connect', { error });
log.warn('High memory usage');
log.info('User logged in', { userId: '123' });
```

### Спеціалізоване логування:

```typescript
// Старт/Стоп
log.start('Server starting...');
log.stop('Server shutting down');

// Успіх/Помилка
log.success('Connected to database');
log.error('Connection failed', { error });

// Мережа
log.connect('Client connected', { clientId: '123' });
log.disconnect('Client disconnected', { reason: 'timeout' });

// Стріми
log.streamStart('Stream started', { title: 'My Stream' });
log.streamEnd('Stream ended', { duration: 3600 });

// База даних
log.dbConnect('MongoDB connected');
log.dbQuery('Query executed', { query: 'find streams' });

// Продуктивність
log.performance('High CPU usage', { cpu: 85 });

// Файли
log.fileWrite('Recording saved', { path: '/media/rec.mp4' });
log.fileRead('Config loaded', { path: '/config.json' });
```

---

## 🎨 Емодзі довідник

| Емодзі | Використання | Приклад |
|--------|--------------|---------|
| 🚀 | Старт процесу | `log.start('Server starting')` |
| 🛑 | Зупинка | `log.stop('Stopping server')` |
| ✅ | Успіх | `log.success('Connected')` |
| ❌ | Помилка | `log.error('Failed')` |
| ⚠️ | Попередження | `log.warn('High memory')` |
| ℹ️ | Інформація | `log.info('User logged in')` |
| 🔍 | Debug | `log.debug('Debugging info')` |
| 🔌 | Підключення | `log.connect('Client connected')` |
| 📡 | Стрім | `log.streamStart('Stream started')` |
| 💾 | База даних | `log.dbConnect('DB connected')` |
| ⚡ | Продуктивність | `log.performance('Metrics')` |
| 📖 | Читання файлу | `log.fileRead('File read')` |

---

## 📊 Рівні логування

### Development (NODE_ENV=development):
```
DEBUG → INFO → WARN → ERROR
```

### Production (NODE_ENV=production):
```
INFO → WARN → ERROR
```

### Налаштування в `.env`:
```env
LOG_LEVEL=info          # info, debug, warn, error
NODE_ENV=development    # development, production
```

---

## 🔎 Перегляд логів

### Real-time моніторинг:

```powershell
# Всі логи
Get-Content logs\combined-2024-10-06.log -Wait -Tail 50

# Тільки помилки
Get-Content logs\error-2024-10-06.log -Wait -Tail 50

# RTMP події
Get-Content logs\rtmp-2024-10-06.log -Wait -Tail 30

# WebSocket події
Get-Content logs\websocket-2024-10-06.log -Wait -Tail 30
```

### Фільтрація логів:

```powershell
# Знайти помилки
Select-String -Path "logs\combined-*.log" -Pattern "error"

# Знайти за часом
Select-String -Path "logs\combined-*.log" -Pattern "2024-10-06 14:"

# Знайти за типом події
Select-String -Path "logs\*.log" -Pattern "streamStart"

# Підрахувати помилки
(Select-String -Path "logs\error-*.log" -Pattern "error").Count
```

---

## 🛠️ Express Middleware

### HTTP Request Logging:

```typescript
import { requestLogger } from './logger';

app.use(requestLogger);

// Автоматично логує:
// ✅ GET /api/streams 200 - 45ms
// ❌ POST /api/upload 500 - 120ms
```

Формат логу:
```json
{
  "timestamp": "2024-10-06 14:30:45",
  "level": "http",
  "message": "✅ GET /api/streams",
  "method": "GET",
  "url": "/api/streams",
  "statusCode": 200,
  "duration": "45ms",
  "ip": "192.168.1.100",
  "userAgent": "Mozilla/5.0..."
}
```

---

## 📈 Structured Logging

### З метаданими:

```typescript
log.streamStart('New stream started', {
  streamId: 'abc123',
  streamer: 'john_doe',
  quality: '1080p',
  fps: 30,
  viewers: 0,
  timestamp: new Date().toISOString()
});
```

JSON вихід:
```json
{
  "timestamp": "2024-10-06 14:30:45",
  "level": "info",
  "message": "📡 New stream started",
  "streamId": "abc123",
  "streamer": "john_doe",
  "quality": "1080p",
  "fps": 30,
  "viewers": 0
}
```

---

## 🔄 Ротація файлів

### Налаштування:

```typescript
// combined logs: 20MB max, 14 днів
maxSize: '20m'
maxFiles: '14d'

// error logs: 20MB max, 30 днів
maxFiles: '30d'

// debug logs: 10MB max, 7 днів
maxFiles: '7d'
```

### Автоматичне видалення:
- Combined: після 14 днів
- Errors: після 30 днів
- Debug: після 7 днів

---

## 🎯 Best Practices

### 1. Використовуйте правильний рівень:

```typescript
// ✅ Правильно
log.error('Database connection failed', { error });
log.warn('High memory usage', { usage: '85%' });
log.info('User logged in', { userId });
log.debug('Request payload', { payload });

// ❌ Неправильно
log.info('Critical error!!!');  // Використовуйте error
log.error('User clicked button');  // Використовуйте debug
```

### 2. Додавайте контекст:

```typescript
// ✅ Правильно
log.error('Failed to save stream', {
  streamId: 'abc123',
  error: error.message,
  timestamp: Date.now()
});

// ❌ Неправильно
log.error('Failed to save');  // Мало інформації
```

### 3. Не логуйте чутливі дані:

```typescript
// ❌ НІКОЛИ не логуйте:
log.info('User logged in', {
  password: user.password,     // НІКОЛИ!
  creditCard: user.card,       // НІКОЛИ!
  apiKey: config.apiKey        // НІКОЛИ!
});

// ✅ Правильно
log.info('User logged in', {
  userId: user.id,
  username: user.username
});
```

### 4. Використовуйте structured logs:

```typescript
// ✅ Правильно
log.performance('High CPU usage', {
  cpu: cpuUsage,
  memory: memUsage,
  connections: activeConnections
});

// ❌ Неправильно
log.performance(`CPU: ${cpuUsage}, Memory: ${memUsage}`);
```

---

## 📊 Аналіз логів

### Статистика помилок:

```powershell
# Підрахунок помилок за день
$errors = Select-String -Path "logs\error-2024-10-06.log" -Pattern "error"
$errors.Count

# Групування за типом
$errors | Group-Object { $_.Line -match '"message":"(.*?)"' | Out-Null; $Matches[1] }
```

### Продуктивність:

```powershell
# Знайти повільні запити
Select-String -Path "logs\combined-*.log" -Pattern "duration.*[0-9]{3,}ms"

# Моніторинг CPU/Memory
Select-String -Path "logs\combined-*.log" -Pattern "performance"
```

---

## 🚨 Алерти та моніторинг

### Налаштування алертів:

```typescript
import { logger } from './logger';

// Критична помилка - відправити повідомлення
logger.on('error', (error) => {
  if (error.level === 'error') {
    // Send email/SMS/Telegram
    notifyAdmin(error);
  }
});

// Моніторинг розміру логів
const logSize = fs.statSync('logs/combined.log').size;
if (logSize > 100 * 1024 * 1024) { // 100MB
  log.warn('Log file too large', { size: logSize });
}
```

---

## 📖 Приклади з реального проекту

### Server startup:

```typescript
log.start('Starting CaptureStream Server', {
  version: '2.0.0',
  port: 3001,
  environment: process.env.NODE_ENV
});

log.dbConnect('MongoDB connected', {
  database: 'capturestream',
  host: 'localhost:27017'
});

log.success('Server ready', {
  uptime: process.uptime(),
  memory: process.memoryUsage()
});
```

### Stream lifecycle:

```typescript
// Початок стріму
log.streamStart('Stream started', {
  streamId: stream.streamId,
  title: stream.title,
  streamer: stream.streamer.username,
  quality: `${stream.quality.resolution} @ ${stream.quality.fps}fps`
});

// Оновлення глядачів
log.info('Viewer count updated', {
  streamId: stream.streamId,
  viewers: stream.viewers,
  peak: stream.peakViewers
});

// Завершення
log.streamEnd('Stream ended', {
  streamId: stream.streamId,
  duration: `${stream.durationMinutes} minutes`,
  peakViewers: stream.peakViewers,
  totalViews: stream.stats.totalViews
});
```

### Помилки:

```typescript
try {
  await stream.save();
} catch (error) {
  log.error('Failed to save stream', {
    streamId: stream.streamId,
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });
}
```

---

## 📚 Документація Winston

- Official: https://github.com/winstonjs/winston
- Transports: https://github.com/winstonjs/winston/blob/master/docs/transports.md
- Formats: https://github.com/winstonjs/winston#formats

---

**Happy Logging! 📝✨**
