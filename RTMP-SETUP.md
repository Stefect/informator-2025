# 📡 RTMP Setup Guide - Налаштування OBS Studio

## 🎯 Швидкий старт

### 1. ⬇️ Встановіть FFmpeg
**Windows:**
1. Завантажте: https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip
2. Розпакуйте в `C:\ffmpeg`
3. Додайте `C:\ffmpeg\bin` до PATH

**Перевірка:**
```bash
ffmpeg -version
```

---

## 🎥 Налаштування OBS Studio

### 1. Відкрийте Налаштування → Stream

### 2. Виберіть "Custom..."

### 3. Введіть дані:

| Параметр | Значення |
|----------|----------|
| **Server** | `rtmp://localhost:1935/live` |
| **Stream Key** | `your_stream_name` (будь-яка назва) |

### 4. Налаштування виводу (Settings → Output)

**Streaming:**
- Output Mode: `Advanced`
- Encoder: `x264`
- Rate Control: `CBR`
- Bitrate: `2500 Kbps` (для 720p)
- Keyframe Interval: `2`
- CPU Usage Preset: `veryfast`

---

## 🔗 URL для перегляду

### HLS (рекомендовано для браузерів):
```
http://localhost:8000/live/your_stream_name/index.m3u8
```

### HTTP-FLV (низька затримка):
```
http://localhost:8000/live/your_stream_name.flv
```

### RTMP (для плеєрів):
```
rtmp://localhost:1935/live/your_stream_name
```

---

## 📺 Перегляд в браузері

### Використайте Video.js або hls.js:

```html
<video id="video" controls></video>
<script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
<script>
  const video = document.getElementById('video');
  const hls = new Hls();
  hls.loadSource('http://localhost:8000/live/your_stream_name/index.m3u8');
  hls.attachMedia(video);
</script>
```

---

## 🔧 Налаштування якості

### 1080p 60fps:
- Bitrate: `6000 Kbps`
- Resolution: `1920x1080`
- FPS: `60`

### 720p 30fps (рекомендовано):
- Bitrate: `2500 Kbps`
- Resolution: `1280x720`
- FPS: `30`

### 480p (для слабкого інтернету):
- Bitrate: `1000 Kbps`
- Resolution: `854x480`
- FPS: `30`

---

## 📂 Структура файлів

```
media/
├── recordings/          # Записані стріми (.mp4)
│   ├── live_stream1_2025-01-15.mp4
│   └── live_stream2_2025-01-15.mp4
└── hls/                # HLS сегменти (.ts + .m3u8)
    └── live/
        └── your_stream_name/
            ├── index.m3u8
            ├── segment0.ts
            ├── segment1.ts
            └── segment2.ts
```

---

## 🐛 Troubleshooting

### ❌ OBS не може підключитись
- Перевірте, чи запущений RTMP сервер
- Переконайтесь, що порт 1935 не зайнятий
- Спробуйте інший Stream Key

### ❌ Відео не відтворюється
- Перевірте, чи встановлений FFmpeg
- Подивіться логи: `logs/rtmp.log`
- Переконайтесь, що HLS файли створюються в `media/hls/`

### ❌ Затримка більше 10 секунд
- Зменшіть `hls_time` в конфігурації
- Використайте HTTP-FLV замість HLS
- Спробуйте WebRTC (в наступній версії)

---

## 🚀 Запуск серверів

### Варіант 1: Окремо
```bash
# Термінал 1: WebSocket сервер
npm start

# Термінал 2: RTMP сервер
npm run rtmp
```

### Варіант 2: Разом (рекомендовано)
```bash
npm run start:all
```

---

## 📊 Моніторинг

### API endpoints:
- `GET /api/streams` - Активні стріми
- `GET /api/recordings` - Записані відео
- `GET /api/stream/:id` - Інформація про стрім

### Логи:
- `logs/rtmp.log` - RTMP сервер
- `logs/combined.log` - Загальні логи

---

## 🎯 Наступні кроки

1. ✅ Запустіть RTMP сервер
2. ✅ Налаштуйте OBS
3. ✅ Почніть трансляцію
4. ✅ Відкрийте http://localhost:3001
5. ✅ Ваш стрім з'явиться на головній

---

## 💡 Поради

- Використовуйте **унікальний Stream Key** для кожного стрімера
- Записи автоматично зберігаються в `media/recordings/`
- HLS має затримку ~10-20 секунд (це нормально)
- Для зменшення затримки використовуйте WebRTC (в розробці)

---

**Потрібна допомога?** Напишіть в issues або перегляньте FAQ
