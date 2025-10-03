# 🚀 Informator GitHub Codespaces - Швидкий старт

## 📋 Покрокова інструкція для запуску в GitHub Codespaces

### Крок 1: Створення Codespace

1. **Відкрийте GitHub репозиторій** `stefect/informator-2025`
2. **Натисніть кнопку "Code"** (зелена кнопка)
3. **Перейдіть на вкладку "Codespaces"**
4. **Натисніть "Create codespace on main"**

Codespace автоматично налаштується з усіма необхідними інструментами! 🎯

---

### Крок 2: Автоматичне налаштування

**GitHub Codespaces автоматично:**
- ✅ Встановить Node.js 18
- ✅ Встановить TypeScript та інструменти розробки
- ✅ Встановить всі залежності проекту
- ✅ Налаштує порти 3000, 8080, 8888
- ✅ Створить публічні URL для доступу

---

### Крок 3: Запуск Informator

В терміналі Codespace виконайте:

```bash
# Швидкий запуск всіх сервісів
npm run codespaces
```

**АБО** запуск через скрипт:

```bash
# Зробити скрипт виконуваним та запустити
chmod +x start-codespaces.sh
./start-codespaces.sh
```

---

### Крок 4: Отримання публічних URL

Після запуску ви побачите URLs такого формату:
```
🌐 Web Interface: https://YOUR-CODESPACE-8080.preview.app.github.dev
🔧 Backend API:   https://YOUR-CODESPACE-3000.preview.app.github.dev
```

**Замініть `YOUR-CODESPACE` на ваше ім'я Codespace!**

---

### Крок 5: Налаштування портів

1. **Відкрийте панель "Ports"** (внизу VS Code)
2. **Переконайтеся що порти 3000 і 8080 мають статус "Public"**
3. **Клікніть на іконку 🌐** біля порту для відкриття URL

---

## 🎯 Готові команди

### Основні команди:
```bash
# Запуск всіх сервісів
npm run codespaces

# Розробка з hot reload
npm run dev:codespaces

# Перегляд логів
tail -f logs/*.log

# Зупинка всіх сервісів
pkill -f 'node.*server'
```

### Перевірка статусу:
```bash
# Перевірка запущених процесів
ps aux | grep node

# Перевірка портів
netstat -tlnp | grep :3000
netstat -tlnp | grep :8080
```

---

## 🌐 Доступ до Informator

### 1. Основний інтерфейс:
- **URL**: `https://YOUR-CODESPACE-8080.preview.app.github.dev`
- **Функції**: YouTube-style інтерфейс, живий чат, контроли відео

### 2. Backend API:
- **URL**: `https://YOUR-CODESPACE-3000.preview.app.github.dev`
- **Функції**: REST API, WebSocket сервер

---

## 📱 Поділитися з друзями

1. **Скопіюйте ваш URL**: `https://YOUR-CODESPACE-8080.preview.app.github.dev`
2. **Поділіться з ким завгодно** - вони зможуть переглядати ваш екран з будь-якої точки світу! 🌍
3. **Живий чат** працює автоматично для всіх глядачів

---

## 🔧 Налаштування для production

### Оновити конфігурацію:
```bash
# Створити production .env
cat > .env << EOF
NODE_ENV=production
CODESPACES=true
PORT=8080
API_PORT=3000
WS_PORT=8888
CORS_ORIGIN=*
HOST=0.0.0.0
EOF
```

### Оптимізація продуктивності:
```bash
# Встановити production залежності
npm ci --production

# Запуск в production режимі
NODE_ENV=production npm start
```

---

## ⚠️ Важливі нотатки

### Screen Capture в Linux Codespace:
- **C++ модуль** може не працювати в Linux середовищі
- **Веб інтерфейс** та **чат** працюють повністю
- **Демо режим** доступний без реального захоплення екрану

### Обмеження Codespaces:
- **60 годин/місяць** безкоштовно для студентів
- **120 core hours/місяць** для GitHub Pro
- **Автозупинка** через 30 хвилин неактивності

### Безпека:
- **Публічні порти** доступні всім у інтернеті
- **Не залишайте чутливі дані** в публічних Codespaces
- **Зупиняйте Codespace** після використання

---

## 🐛 Вирішення проблем

### Порти не доступні:
```bash
# Перевірка запущених сервісів
ps aux | grep node

# Перезапуск сервісів
pkill -f node
npm run codespaces
```

### WebSocket помилки:
```bash
# Перевірка WebSocket сервера
curl -I https://YOUR-CODESPACE-8888.preview.app.github.dev

# Перевірка логів
tail -f logs/web.log
```

### Повна переустановка:
```bash
# Очищення та переустановка
rm -rf node_modules */node_modules
npm run setup:codespaces
npm run codespaces
```

---

## 📊 Моніторинг

### Використання ресурсів:
```bash
# CPU та пам'ять
top

# Дисковий простір
df -h

# Мережа
iftop
```

### Логування:
```bash
# Всі логи
tail -f logs/*.log

# Тільки помилки
grep -i error logs/*.log

# WebSocket логи
tail -f logs/web.log | grep -i websocket
```

---

## 🎉 Готово!

Ваш **Informator** тепер доступний в інтернеті через GitHub Codespaces! 

🌟 **Поділіться URL з друзями та демонструйте ваш екран з будь-якої точки світу!**

---

## 📞 Підтримка

Якщо виникли проблеми:
1. Перевірте логи: `tail -f logs/*.log`
2. Перезапустіть: `./start-codespaces.sh`
3. Створіть новий Codespace якщо проблема не вирішується

**Успіхів з Informator в хмарі! ☁️🚀**