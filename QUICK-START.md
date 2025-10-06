# 🚀 Швидкий старт - Quick Start Guide

## ⚡ За 5 хвилин до першого стріму!

### 📋 Передумови

1. **Node.js 18+** - [Завантажити](https://nodejs.org/)
2. **FFmpeg** - [Інструкція](./RTMP-SETUP.md#1-️-встановіть-ffmpeg)
3. **OBS Studio** (опційно) - [Завантажити](https://obsproject.com/)

---

## 🎬 Варіант 1: Browser Streaming (Найпростіший)

### 1. Запустіть сервер
```bash
npm install
npm run build
npm start
```

### 2. Відкрийте браузер
```
http://localhost:3001
```

### 3. Натисніть "Створити стрім"
- Введіть ім'я та прізвище
- Натисніть "Почати трансляцію"
- Виберіть екран для захоплення
- ✅ Готово! Ваш стрім живе!

### 4. Перегляд
- Відкрийте в іншій вкладці: `http://localhost:3001`
- Ваш стрім з'явиться на головній!

---

## 📹 Варіант 2: OBS Studio (Професійний)

### 1. Запустіть ОБА сервера
```bash
npm run start:all
```

Ви побачите:
```
✅ WebSocket Server: http://localhost:3001
✅ RTMP Server: rtmp://localhost:1935/live
```

### 2. Налаштуйте OBS

**Settings → Stream:**
- **Server:** `rtmp://localhost:1935/live`
- **Stream Key:** `my_stream` (будь-яка назва)

**Settings → Output:**
- **Encoder:** `x264`
- **Bitrate:** `2500 Kbps`
- **Keyframe Interval:** `2`

### 3. Додайте джерела в OBS
- ➕ Display Capture (захоплення екрану)
- ➕ Audio Input Capture (мікрофон)
- ➕ Browser Source (для оверлеїв)

### 4. Почніть трансляцію
- Натисніть "Start Streaming" в OBS
- Чекайте 10-15 секунд (HLS конвертація)

### 5. Перегляд в браузері
```
http://localhost:8000/live/my_stream/index.m3u8
```

---

## 📊 Корисні команди

### Перевірка статусу
```bash
curl http://localhost:3001/api/status
```

### Перегляд логів
```bash
tail -f logs/rtmp.log
tail -f logs/combined.log
```

---

**Успіхів зі стрімингом! 🚀📹**
