# 🎥 Capture Client

Windows клієнт для захоплення екрану з мінімальним споживанням ресурсів.

## 📋 Опис

Capture Client - це Node.js програма, яка запускається на Windows 10/11 та виконує:
- Захоплення екрану через DXGI (Direct3D 11)
- Апаратне кодування в H.264
- Передачу потоку на Backend сервер через WebSocket
- Мінімальне споживання CPU (<5%) та RAM (<100MB)

## 🛠️ Технології

- **TypeScript** - основна мова
- **Node.js NAPI** - нативні аддони на C++
- **DXGI** - захоплення екрану (Desktop Duplication API)
- **Media Foundation** - H.264 кодування
- **WebSocket** - передача потоку

## 📦 Встановлення

### Вимоги
- Windows 10/11
- Node.js >= 18.0.0
- Visual Studio Build Tools (для компіляції C++)
- Python 3.x (для node-gyp)

### Встановлення Build Tools

```powershell
# Встановити через npm
npm install --global windows-build-tools

# АБО встановити вручну:
# Visual Studio Build Tools 2019/2022
# https://visualstudio.microsoft.com/downloads/
```

### Встановлення залежностей

```bash
# Перейти в директорію
cd packages/capture-client

# Встановити залежності
npm install

# Зібрати нативні модулі
npm run build:native

# Зібрати TypeScript
npm run build
```

## 🚀 Запуск

### Конфігурація

Створіть файл `.env`:

```env
# Server
SERVER_URL=ws://localhost:3001

# Capture Settings
CAPTURE_FPS=30
CAPTURE_QUALITY=75
CAPTURE_WIDTH=1920
CAPTURE_HEIGHT=1080
CAPTURE_CODEC=h264

# Hardware Encoding
HARDWARE_ENCODING=true

# Recording (optional)
ENABLE_RECORDING=false
RECORDING_PATH=./recordings

# Logging
LOG_LEVEL=info
```

### Запуск клієнта

```bash
# Production
npm start

# Development (з ts-node)
npm run dev
```

## 📁 Структура

```
capture-client/
├── native/                 # C++ NAPI модулі
│   ├── module.cpp          # Головний модуль NAPI
│   ├── screen-capture.h/cpp # DXGI захоплення
│   └── encoder.h/cpp       # H.264 кодування
├── src/
│   ├── index.ts            # Головний файл
│   ├── capture-manager.ts  # Менеджер захоплення
│   ├── stream-sender.ts    # WebSocket клієнт
│   ├── performance-monitor.ts # Моніторинг
│   ├── config.ts           # Конфігурація
│   └── logger.ts           # Логування
├── binding.gyp             # node-gyp конфігурація
├── package.json
├── tsconfig.json
└── README.md
```

## 🔧 Налаштування продуктивності

### Захоплення екрану
- **FPS**: 30+ (вимога конкурсу: мінімум 3 FPS)
- **Роздільність**: 720p+ (рекомендовано 1080p)
- **CPU**: <5% при використанні DXGI

### Кодування
- **H.264**: Апаратне (NVENC/QuickSync) або програмне
- **Якість**: 75 (баланс між якістю і розміром)
- **Бітрейт**: Динамічний (залежить від якості)

### Мережа
- **Протокол**: WebSocket (сумісний з Cloudflare)
- **Передача**: 2-5 Mbps upload
- **Затримка**: <100ms

## 📊 Протокол комунікації

### Client -> Server

#### 1. Ідентифікація
```json
{
  "type": "identification",
  "clientType": "capture_client",
  "version": "2.0.0",
  "platform": "win32",
  "hostname": "DESKTOP-ABC123"
}
```

#### 2. Метадані кадру
```json
{
  "type": "frame_metadata",
  "width": 1920,
  "height": 1080,
  "timestamp": 1704718800000,
  "frameNumber": 1234,
  "size": 45678
}
```

#### 3. Бінарні дані (Binary WebSocket frame)
Закодований H.264 кадр

#### 4. Метрики
```json
{
  "type": "metrics",
  "data": {
    "fps": 30.2,
    "cpuUsage": 4.5,
    "memoryUsageMB": 85
  }
}
```

### Server -> Client

#### 1. Команда запуску
```json
{
  "type": "command",
  "command": {
    "type": "start_capture"
  }
}
```

#### 2. Команда зупинки
```json
{
  "type": "command",
  "command": {
    "type": "stop_capture"
  }
}
```

#### 3. Оновлення налаштувань
```json
{
  "type": "command",
  "command": {
    "type": "update_settings",
    "settings": {
      "fps": 60,
      "quality": 85
    }
  }
}
```

## 🐛 Дебагінг

### Логи
Логи зберігаються в `./logs/`:
- `capture-client-YYYY-MM-DD.log`

### Перевірка нативних модулів

```bash
# Перевірити збірку
node -e "console.log(require('./build/Release/screen_capture.node'))"

# Тест захоплення
npm test
```

### Типові проблеми

1. **Не компілюється нативний модуль**
   - Перевірте Visual Studio Build Tools
   - `npm install --global windows-build-tools`

2. **Не захоплює екран**
   - Перевірте права адміністратора
   - Перевірте, чи підтримується DXGI

3. **Високе споживання CPU**
   - Увімкніть апаратне кодування
   - Зменшіть FPS або якість

## 📝 TODO

### Поточна реалізація (шаблон)
- [x] TypeScript структура
- [x] WebSocket клієнт
- [x] Моніторинг продуктивності
- [x] Логування
- [ ] Повна DXGI реалізація
- [ ] H.264 кодування через Media Foundation
- [ ] Оптимізація продуктивності

### Необхідно реалізувати
1. **DXGI Capture** (`native/screen-capture.cpp`)
   - Ініціалізація Direct3D 11
   - Desktop Duplication API
   - Копіювання текстур з GPU

2. **H.264 Encoding** (`native/encoder.cpp`)
   - Media Foundation Transform
   - Апаратне кодування (NVENC/QuickSync)
   - Налаштування бітрейту

3. **Оптимізація**
   - Zero-copy передача даних
   - Пул буферів
   - Асинхронна обробка

## 📄 Ліцензія

MIT

---

**Створено для конкурсу Informator 2025**
