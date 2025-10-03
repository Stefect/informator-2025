# 🖥️ Informator - Система захоплення екрану# 🖥️ Informator - Live Desktop Stream



Простий та чистий сервер для захоплення та трансляції екрану в реальному часі.**Informator** - це потужний інструмент для захоплення та трансляції робочого столу в реальному часі через веб-браузер.



## 🚀 Швидкий старт## 🎯 Основні можливості



### Встановлення залежностей- 🎥 **Live відео-стрім** з робочого столу (15/30/60 FPS)

```bash- 🌐 **Веб-інтерфейс** для перегляду стріму

npm install- ⚡ **Налаштування FPS** в реальному часі

```- 📊 **Статистика потоку** (кадри, розмір, FPS)

- 🎨 **Красивий інтерфейс** з українською мовою

### Запуск сервера- 🔧 **Нативний модуль захоплення** (C++/N-API)

```bash

npm run dev## 🚀 Швидкий старт

```

### Вимоги

Або скомпілювати та запустити:- Node.js 16+ 

```bash- Windows (з GDI підтримкою)

npm run build- Visual Studio Build Tools (для компіляції нативного модуля)

npm start

```### Встановлення



### Відкриття інтерфейсу1. Клонуйте репозиторій:

Відкрийте браузер та перейдіть на: `http://localhost:3001````bash

git clone https://github.com/yourusername/informator.git

## 📁 Структура проектуcd informator

informator/2. Перейдіть в каталог Windows:

├── src/```bash

│   ├── server.ts          # Основний серверcd windows

│   └── client.ts          # Клієнт захоплення```

├── index.html             # Веб-інтерфейс

├── package.json3. Встановіть залежності:

├── tsconfig.json```bash

└── README.mdnpm install

``````



## 🔧 Можливості4. Скомпілюйте нативний модуль:

```bash

- ✅ WebSocket сервер на порту 3001npm rebuild

- ✅ Веб-інтерфейс для перегляду```

- ✅ Автоматичне перепідключення

- ✅ Чистий TypeScript код5. Запустіть live відео-сервер:

- ✅ Мінімальні залежності```bash

node live-video-server.js

## 📝 Команди```



- `npm run dev` - Запуск в режимі розробки6. Відкрийте браузер: http://localhost:3001

- `npm run build` - Компіляція TypeScript

- `npm start` - Запуск скомпільованого сервера## 🎮 Використання

- `npm run clean` - Очистка папки dist

1. **Запустіть сервер** командою `node live-video-server.js`

## 🛠️ Технології2. **Відкрийте браузер** на http://localhost:3001

3. **Натисніть "Запустити стрім"** для початку трансляції

- **Backend**: Node.js + TypeScript + Express + WebSocket4. **Виберіть FPS** в випадаючому меню (15/30/60)

- **Frontend**: Vanilla JavaScript + HTML5 Canvas5. **Насолоджуйтесь** плавним live відео з робочого столу!

- **Build**: TypeScript Compiler


## ⚙️ Технології

- **Backend**: Node.js, Express.js, WebSocket (ws)
- **Frontend**: HTML5, Canvas API, WebSocket API
- **Native**: C++, N-API, Windows GDI
- **Build**: node-gyp, Visual Studio Build Tools

## 🎯 Налаштування FPS

Проект підтримує динамічну зміну швидкості кадрів:

- **15 FPS** - економія ресурсів, стандартна якість
- **30 FPS** - плавне відео (рекомендовано)
- **60 FPS** - максимальна плавність

## 🐛 Відомі проблеми

- Працює лише на Windows (через GDI API)
- Потребує компіляції нативного модуля
- Високе навантаження при 60 FPS

## 🤝 Внесок у проект

1. Форкніть репозиторій
2. Створіть feature-гілку: `git checkout -b feature/amazing-feature`
3. Закомітьте зміни: `git commit -m 'Add amazing feature'`
4. Запушіть в гілку: `git push origin feature/amazing-feature`
5. Створіть Pull Request


⭐ Поставте зірку, якщо проект вам сподобався!
