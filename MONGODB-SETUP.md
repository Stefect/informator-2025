# 💾 MongoDB Setup Guide

## 📥 Встановлення MongoDB (Windows)

### Варіант 1: MongoDB Community Server (Локальна база)

1. **Завантажте MongoDB Community Server:**
   - Перейдіть на https://www.mongodb.com/try/download/community
   - Виберіть версію для Windows
   - Завантажте та встановіть `.msi` інсталятор

2. **Під час встановлення:**
   - Виберіть "Complete" installation
   - Встановіть MongoDB як Windows Service
   - Install MongoDB Compass (GUI для MongoDB)

3. **Перевірте встановлення:**
   ```powershell
   mongod --version
   ```

4. **Запуск MongoDB:**
   ```powershell
   # MongoDB має запуститися автоматично як служба Windows
   # Перевірка статусу:
   Get-Service MongoDB
   
   # Або запустіть вручну:
   net start MongoDB
   ```

---

### Варіант 2: MongoDB Atlas (Cloud база - безкоштовно)

1. **Створіть акаунт:**
   - Перейдіть на https://www.mongodb.com/cloud/atlas
   - Sign Up безкоштовно

2. **Створіть кластер:**
   - Create a FREE Shared Cluster
   - Виберіть регіон (найближчий до вас)
   - Назвіть кластер (наприклад, `CaptureStream`)

3. **Налаштуйте безпеку:**
   - Database Access → Add New Database User
   - Username: `capturestream`
   - Password: створіть сильний пароль
   - Role: Atlas admin

4. **Network Access:**
   - IP Access List → Add IP Address
   - Allow Access from Anywhere: `0.0.0.0/0` (для розробки)
   - ⚠️ У продакшені обмежте доступ!

5. **Отримайте Connection String:**
   - Clusters → Connect → Connect your application
   - Скопіюйте connection string:
   ```
   mongodb+srv://capturestream:<password>@cluster0.xxxxx.mongodb.net/capturestream?retryWrites=true&w=majority
   ```

6. **Оновіть `.env`:**
   ```env
   MONGODB_URI=mongodb+srv://capturestream:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/capturestream?retryWrites=true&w=majority
   ```

---

## 🔧 Налаштування проекту

### 1. Оновіть `.env` файл:

```env
# Локальна база
MONGODB_URI=mongodb://localhost:27017/capturestream

# Або Atlas (cloud)
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/capturestream
```

### 2. Встановіть залежності:

```powershell
npm install
```

### 3. Запустіть проект:

```powershell
npm run build
npm run start:all
```

---

## 📊 MongoDB Compass (GUI)

1. **Відкрийте MongoDB Compass**
2. **Підключіться:**
   - Локально: `mongodb://localhost:27017`
   - Atlas: вставте connection string з Atlas

3. **Огляньте бази даних:**
   - База: `capturestream`
   - Колекції:
     - `streams` - активні та завершені стріми
     - `users` - користувачі
     - `recordings` - записи відео

---

## 🔍 Перевірка роботи

### Через Terminal:

```powershell
# Підключення до MongoDB
mongosh

# Використовуйте базу
use capturestream

# Перегляньте колекції
show collections

# Перегляньте стріми
db.streams.find().pretty()

# Підрахуйте стріми
db.streams.countDocuments()

# Знайдіть активні стріми
db.streams.find({ status: 'live' })

# Очистіть тестові дані
db.streams.deleteMany({})
```

---

## 📈 Індекси (для продуктивності)

Індекси створюються автоматично при запуску, але ви можете переглянути їх:

```javascript
// Streams indexes
db.streams.getIndexes()

// Створити додаткові індекси вручну:
db.streams.createIndex({ "startTime": -1 })
db.streams.createIndex({ "streamer.username": 1 })
db.streams.createIndex({ "status": 1, "startTime": -1 })
```

---

## 🚀 Production Tips

### 1. Backup стратегія:

```powershell
# Експорт бази
mongodump --uri="mongodb://localhost:27017/capturestream" --out=./backup

# Імпорт бази
mongorestore --uri="mongodb://localhost:27017/capturestream" ./backup/capturestream
```

### 2. Моніторинг:

```javascript
// Статистика бази
db.stats()

// Статистика колекції
db.streams.stats()

// Поточні операції
db.currentOp()
```

### 3. Оптимізація:

```javascript
// Аналіз повільних запитів
db.setProfilingLevel(2)
db.system.profile.find().sort({ ts: -1 }).limit(5)

// Вимкнути профілювання
db.setProfilingLevel(0)
```

---

## ❗ Troubleshooting

### MongoDB не запускається:

```powershell
# Перевірте службу
Get-Service MongoDB

# Запустіть вручну
net start MongoDB

# Перегляньте логи
Get-Content "C:\Program Files\MongoDB\Server\7.0\log\mongod.log" -Tail 50
```

### Помилка підключення:

1. Перевірте що MongoDB запущений
2. Перевірте `.env` - правильний connection string
3. Перевірте firewall - порт 27017 має бути відкритий
4. Для Atlas - перевірте IP whitelist

### Повільна робота:

1. Додайте індекси для частих запитів
2. Обмежте кількість документів (pagination)
3. Використовуйте projection (вибірка полів)
4. Налаштуйте кешування

---

## 📚 Корисні команди

```javascript
// Статистика стрімів
db.streams.aggregate([
  { $group: {
    _id: "$status",
    count: { $sum: 1 },
    avgDuration: { $avg: "$duration" }
  }}
])

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

// Очистка старих стрімів
db.streams.deleteMany({
  status: "ended",
  endTime: { $lt: new Date(Date.now() - 30*24*60*60*1000) } // Старіші 30 днів
})
```

---

## 🔐 Security Checklist

- [ ] Змініть стандартний порт (27017)
- [ ] Увімкніть аутентифікацію
- [ ] Використовуйте сильні паролі
- [ ] Обмежте доступ по IP
- [ ] Увімкніть SSL/TLS
- [ ] Регулярні backup
- [ ] Оновлюйте MongoDB до останньої версії

---

## 📖 Documentation

- Official: https://www.mongodb.com/docs/
- Mongoose: https://mongoosejs.com/docs/
- Atlas: https://www.mongodb.com/docs/atlas/

---

**MongoDB is ready! 🎉**
