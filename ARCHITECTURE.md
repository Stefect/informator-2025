# 🏗️ Архітектура CaptureStream - YouTube Live Clone

## 📊 Діаграма системи

```
┌─────────────────────────────────────────────────────────────────────┐
│                        КЛІЄНТИ (USERS)                               │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                 ┌───────────────┼───────────────┐
                 │               │               │
            ┌────▼────┐     ┌────▼────┐     ┌───▼─────┐
            │  OBS    │     │ Browser │     │ Browser │
            │ Studio  │     │ Streamer│     │ Viewer  │
            │ (RTMP)  │     │(WebRTC) │     │ (HLS)   │
            └────┬────┘     └────┬────┘     └────┬────┘
                 │               │               │
                 │    RTMP       │   WebSocket   │   HTTP
                 │   :1935       │    :3001      │   :8000
                 │               │               │
┌────────────────┴───────────────┴───────────────┴────────────────────┐
│                        СЕРВЕРНИЙ ШАР                                 │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌────────────────┐        ┌────────────────┐                        │
│  │  RTMP Server   │        │ WebSocket      │                        │
│  │  (Node-Media)  │◄──────►│ Server         │                        │
│  │  Port: 1935    │        │ (Express+WS)   │                        │
│  │  Port: 8000    │        │ Port: 3001     │                        │
│  └────────┬───────┘        └────────┬───────┘                        │
│           │                         │                                │
│           │    ┌────────────────────┤                                │
│           │    │                    │                                │
│  ┌────────▼────▼───┐       ┌────────▼────────┐                       │
│  │   FFmpeg        │       │  Stream Manager │                       │
│  │   Transcoder    │       │  (Metadata)     │                       │
│  │                 │       └────────┬────────┘                       │
│  │ • RTMP→HLS      │                │                                │
│  │ • Recording     │                │                                │
│  │ • Thumbnails    │                │                                │
│  └────────┬────────┘                │                                │
│           │                         │                                │
└───────────┼─────────────────────────┼────────────────────────────────┘
            │                         │
            │                         │
┌───────────▼─────────────────────────▼────────────────────────────────┐
│                        ЗБЕРІГАННЯ (STORAGE)                           │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │   HLS Segments   │  │   Recordings     │  │   Metadata DB    │   │
│  │                  │  │                  │  │                  │   │
│  │ media/hls/       │  │ media/           │  │ streams.json     │   │
│  │ ├─ live/         │  │ recordings/      │  │                  │   │
│  │ │  ├─ stream1/   │  │ ├─ video1.mp4    │  │ {stream info,    │   │
│  │ │  │  ├─ .m3u8   │  │ ├─ video2.mp4    │  │  viewers,        │   │
│  │ │  │  ├─ .ts     │  │ └─ video3.mp4    │  │  duration}       │   │
│  │ │  │  └─ .ts     │  │                  │  │                  │   │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘   │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Потоки даних (Data Flow)

### 1. 📡 RTMP Streaming (OBS → Сервер)

```
OBS Studio
    │
    │ RTMP Stream (H.264 + AAC)
    │ rtmp://localhost:1935/live/stream_key
    ▼
Node-Media-Server (Port 1935)
    │
    ├─► FFmpeg Transcoder
    │   │
    │   ├─► HLS Converter (.m3u8 + .ts segments)
    │   │   └─► media/hls/live/stream_key/
    │   │
    │   └─► MP4 Recorder
    │       └─► media/recordings/stream_key_timestamp.mp4
    │
    └─► Stream Manager
        └─► streams.json (metadata)
```

### 2. 🌐 WebRTC Streaming (Browser → Сервер)

```
Browser (Screen Capture API)
    │
    │ getDisplayMedia()
    │ MediaStream (VP8/VP9)
    ▼
WebSocket (Port 3001)
    │
    ├─► JPEG Frames (Binary Data)
    │   └─► Broadcast to all viewers
    │
    └─► Stream Info (JSON Messages)
        ├─► register
        ├─► startStream
        └─► stopStream
```

### 3. 👁️ Viewing (Глядач)

```
Browser Viewer
    │
    ├─► HTTP Request
    │   └─► GET http://localhost:8000/live/stream_key/index.m3u8
    │       │
    │       ▼
    │   HLS Player (hls.js / Video.js)
    │       │
    │       └─► Segments (.ts files)
    │
    └─► WebSocket Connection
        └─► Real-time chat, viewer count, metadata
```

---

## 🧩 Компоненти системи

### 1. 📡 RTMP Server (`src/rtmp-server.ts`)

**Функції:**
- ✅ Приймає RTMP стріми від OBS
- ✅ Транскодує в HLS для браузерів
- ✅ Записує в MP4 файли
- ✅ HTTP-FLV для низької затримки
- ✅ Зберігає метадані стрімів

**Технології:**
- `node-media-server` - RTMP сервер
- `fluent-ffmpeg` - Обробка відео
- FFmpeg - Транскодинг

**Порти:**
- `1935` - RTMP ingestion
- `8000` - HTTP-FLV + HLS delivery

---

### 2. 🔌 WebSocket Server (`src/server.ts`)

**Функції:**
- ✅ WebRTC screen capture (browser)
- ✅ Real-time frame broadcasting
- ✅ Stream management API
- ✅ Viewer count tracking
- ✅ Chat system

**Технології:**
- `Express` - HTTP сервер
- `ws` - WebSocket library
- `winston` - Logging

**Порт:**
- `3001` - WebSocket + HTTP API

---

### 3. 🎨 Frontend (`public/`)

**Сторінки:**
- `index.html` - Головна (список стрімів)
- `studio.html` - Студія стрімера
- `watch.html` - Перегляд стріму
- `library.html` - Відеотека (VOD)

**Функції:**
- ✅ YouTube-style UI
- ✅ Sidebar navigation
- ✅ Live stream cards
- ✅ Video player controls
- ✅ Real-time chat
- ✅ Stream statistics

---

### 4. 💾 Storage Layer

**HLS Segments (`media/hls/`):**
```
hls/
└── live/
    └── stream_key/
        ├── index.m3u8      # Playlist
        ├── segment0.ts     # 2-10 sec chunks
        ├── segment1.ts
        └── segment2.ts
```

**Recordings (`media/recordings/`):**
```
recordings/
├── live_stream1_2025-01-15T12-00-00.mp4
├── live_stream2_2025-01-15T14-30-00.mp4
└── live_stream3_2025-01-15T18-45-00.mp4
```

**Metadata (`streams.json`):**
```json
[
  {
    "id": "client_123456",
    "app": "live",
    "stream": "stream_key",
    "startTime": 1705320000000,
    "endTime": 1705323600000,
    "duration": 3600,
    "recordingPath": "media/recordings/live_stream1.mp4",
    "hlsPath": "live/stream_key/index.m3u8"
  }
]
```

---

## 🔀 Протоколи

### RTMP (Real-Time Messaging Protocol)
- **Використання:** OBS → Сервер
- **Порт:** 1935
- **Кодек:** H.264 (video) + AAC (audio)
- **Затримка:** ~5-10 секунд
- **Переваги:** Стабільний, підтримка кодерами

### HLS (HTTP Live Streaming)
- **Використання:** Сервер → Браузери
- **Порт:** 8000 (HTTP)
- **Формат:** .m3u8 playlist + .ts segments
- **Затримка:** ~10-30 секунд
- **Переваги:** Універсальна підтримка, CDN-ready

### WebSocket
- **Використання:** Браузер ↔ Сервер
- **Порт:** 3001
- **Формат:** Binary (frames) + JSON (messages)
- **Затримка:** ~100-500ms
- **Переваги:** Низька затримка, двостороннє з'єднання

### HTTP-FLV
- **Використання:** Альтернатива HLS
- **Порт:** 8000
- **Формат:** FLV over HTTP
- **Затримка:** ~3-5 секунд
- **Переваги:** Нижча затримка ніж HLS

---

## 🚀 Потік запуску

### 1. Запуск серверів
```bash
npm run build        # Компіляція TypeScript
npm run start:all    # Обидва сервери разом
```

### 2. Реєстрація події "Stream Start"
```typescript
// RTMP сервер
nms.on('postPublish', (id, StreamPath) => {
  // 1. Створити запис в streams.json
  // 2. Запустити FFmpeg транскодинг
  // 3. Повідомити WebSocket клієнтів
});
```

### 3. Розповсюдження кадрів
```typescript
// WebSocket broadcast
captureSession.viewers.forEach(viewer => {
  viewer.ws.send(frameData); // Binary
});
```

### 4. Завершення стріму
```typescript
nms.on('donePublish', (id, StreamPath) => {
  // 1. Зупинити FFmpeg
  // 2. Фіналізувати MP4 файл
  // 3. Оновити metadata з duration
  // 4. Повідомити клієнтів
});
```

---

## 📊 API Endpoints

### Stream Management

```
GET  /api/status              # Статус сервера
GET  /api/streams             # Активні стріми
GET  /api/stream/:id          # Інфо про стрім
GET  /api/recordings          # Записані відео
POST /api/capture/config      # Оновити конфігурацію
```

### WebSocket Messages

**Client → Server:**
```json
{ "type": "register", "role": "viewer" }
{ "type": "getStreams" }
{ "type": "start_native_capture", "config": {...} }
```

**Server → Client:**
```json
{ "type": "streamList", "streams": [...] }
{ "type": "viewerCount", "count": 42 }
{ "type": "streamEnded", "streamId": "..." }
```

---

## 🔐 Security (Майбутнє)

1. **Stream Keys:** Унікальні ключі для кожного стрімера
2. **Auth Middleware:** JWT токени
3. **Rate Limiting:** Обмеження запитів
4. **CORS:** Налаштування дозволених доменів
5. **Encryption:** SSL/TLS для продакшену

---

## 📈 Масштабування

### Horizontal Scaling
- **Load Balancer** (Nginx)
- **Multiple Workers** (PM2 cluster mode)
- **Redis** для shared state
- **CDN** для HLS delivery

### Vertical Scaling
- **Більше CPU:** Для FFmpeg транскодингу
- **Більше RAM:** Для кешування
- **SSD Storage:** Для швидкого запису

---

## 🎯 Roadmap

- [x] RTMP сервер
- [x] HLS конвертація
- [x] Запис трансляцій
- [x] YouTube-style UI
- [ ] WebRTC підтримка
- [ ] Чат система
- [ ] База даних (MongoDB/PostgreSQL)
- [ ] Авторизація користувачів
- [ ] VOD відеотека
- [ ] CDN інтеграція
- [ ] Analytics dashboard
- [ ] Mobile app

---

**Автор:** CaptureStream Team  
**Версія:** 2.0.0  
**Дата:** 2025
