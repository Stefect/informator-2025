<div align="center">

# 🖥️ CaptureStream

### Професійна система захоплення та трансляції екрану в реальному часі

[![Live Demo](https://img.shields.io/badge/Live-capturestream.com-blue?style=for-the-badge)](http://capturestream.com/)
[![GitHub](https://img.shields.io/badge/GitHub-informator--2025-181717?style=for-the-badge&logo=github)](https://github.com/Stefect/informator-2025)
[![Node](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)

[🚀 Live Demo](http://capturestream.com/) | [📺 Стрімер](http://capturestream.com/host.html) | [👁️ Глядач](http://capturestream.com/viewer.html) | [📖 Документація](./DEPLOYMENT-GUIDE.md)

---

</div>

## 🌟 Про проект

**CaptureStream** (Informator) - це потужний інструмент для захоплення та трансляції робочого столу в реальному часі через веб-браузер. Повністю безкоштовний та open-source.

## 🎯 Основні можливості

- 🎥 **Live відео-стрім** з робочого столу (15/30/60 FPS)
- 🌐 **Веб-інтерфейс** для перегляду стріму
- ⚡ **Налаштування FPS** в реальному часі
- 📊 **Статистика потоку** (кадри, розмір, FPS)
- 🎨 **Красивий інтерфейс** з українською мовою
- 🔧 **Нативний модуль захоплення** (C++/N-API)
- ☁️ **GitHub Codespaces підтримка**

## 🚀 Швидкий старт

### 🌐 Онлайн версія (Рекомендовано)

**Найпростіший спосіб** - використати онлайн версію:

1. **Головна сторінка**: [http://capturestream.com/](http://capturestream.com/)

2. **Для стрімера**: [http://capturestream.com/host.html](http://capturestream.com/host.html)

3. **Для глядачів**: [http://capturestream.com/viewer.html](http://capturestream.com/viewer.html)

### 💻 Локальна установка

#### Вимоги
- Node.js 16+ 
- Windows (з GDI підтримкою)
- Visual Studio Build Tools (для компіляції нативного модуля)

### Встановлення

1. Клонуйте репозиторій:

```bash
git clone https://github.com/Stefect/informator-2025.git
cd informator-2025
```

2. Встановіть залежності:
```bash
npm install
```

3. Скомпілюйте проект:
```bash
npm run build
```

4. Запустіть сервер:
```bash
npm start
```

5. Відкрийте браузер:
- **Для стрімера**: http://localhost:3001/host.html
- **Для глядачів**: http://localhost:3001/viewer.html

### ☁️ Створення власного Codespace

1. Перейдіть на [GitHub Repository](https://github.com/Stefect/informator-2025)
2. Натисніть "Code" → "Codespaces" → "Create codespace on main"
3. Дочекайтеся автоматичного налаштування
4. Відкрийте порти 3001 для публічного доступу

## 📁 Структура проекту

```
informator-2025/
├── src/
│   ├── server.ts          # Основний сервер
│   └── client.ts          # Клієнт захоплення
├── host.html             # Інтерфейс стрімера
├── viewer.html           # Інтерфейс глядача
├── package.json
├── tsconfig.json
└── README.md
```

## 🎮 Використання

1. **Запустіть сервер** командою `npm start`
2. **Стрімер** відкриває `host.html` для контролю трансляції
3. **Глядачі** відкривають `viewer.html` для перегляду
4. **Насолоджуйтесь** плавним live відео з робочого столу!

## ⚙️ Технології

- **Backend**: Node.js, Express.js, WebSocket (ws)
- **Frontend**: HTML5, Canvas API, WebSocket API
- **Native**: C++, N-API, Windows GDI
- **Build**: node-gyp, Visual Studio Build Tools

## 📝 Команди

- `npm run dev` - Запуск в режимі розробки
- `npm run build` - Компіляція TypeScript
- `npm start` - Запуск скомпільованого сервера
- `npm run clean` - Очистка папки dist

## 🎯 Налаштування FPS

Проект підтримує динамічну зміну швидкості кадрів:
- **15 FPS** - економія ресурсів, стандартна якість
- **30 FPS** - плавне відео (рекомендовано)
- **60 FPS** - максимальна плавність для ігор

## ⚠️ Обмеження

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
