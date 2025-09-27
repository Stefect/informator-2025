// Простий сервер захоплення екрану з резервним генератором зображень
const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');

// Додаткова діагностика
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION:', reason);
});

// Порт для сервера
const PORT = 3000;

// Створення Express додатку
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Глобальні змінні
let captureModule = null;
let clients = new Map(); // Змінюємо на Map для кращого керування клієнтами
let isCapturing = false;
let captureInterval = null;
let testImageBuffer = null;
let frameCounter = 0;

// Конфігурація
const config = {
  quality: 75,
  scale: 1.0,
  fps: 2
};

// Статистика
const stats = {
  framesSent: 0,
  startTime: Date.now(),
  lastFrameSize: 0
};

// Спроба завантажити нативний модуль
try {
  console.log('Спроба завантаження модуля захоплення екрану...');
  
  const modulePaths = [
    './build/Release/gdi_screen_capture.node',
    './gdi_screen_capture.node'
  ];
  
  for (const modulePath of modulePaths) {
    try {
      if (fs.existsSync(modulePath)) {
        console.log(`Файл знайдено: ${modulePath}`);
        captureModule = require(modulePath);
        
        if (captureModule) {
          console.log('Модуль успішно завантажено');
          console.log('Доступні методи:', Object.keys(captureModule));
          
          // Встановлюємо параметри
          if (typeof captureModule.setQuality === 'function') {
            captureModule.setQuality(config.quality);
            console.log(`Встановлено якість: ${config.quality}`);
          }
          
          if (typeof captureModule.setResolutionScale === 'function') {
            captureModule.setResolutionScale(config.scale);
            console.log(`Встановлено масштаб: ${config.scale}`);
          }
          
          if (typeof captureModule.setTargetFPS === 'function') {
            captureModule.setTargetFPS(config.fps);
            console.log(`Встановлено FPS: ${config.fps}`);
          }
          
          if (typeof captureModule.setActiveClients === 'function') {
            captureModule.setActiveClients(1);
            console.log(`Встановлено кількість клієнтів: 1`);
          }
          
          break;
        }
      }
    } catch (err) {
      console.error(`Помилка при завантаженні ${modulePath}:`, err);
    }
  }
} catch (error) {
  console.error('Помилка при завантаженні модуля:', error);
}

// Спроба використати нативний модуль для тесту
let nativeModuleWorking = false;
if (captureModule) {
  try {
    console.log('Тестуємо нативний модуль захоплення...');
    
    if (typeof captureModule.capture === 'function') {
      const testFrame = captureModule.capture();
      if (testFrame && testFrame.length > 0) {
        console.log(`Тест успішний! Отримано кадр розміром ${testFrame.length} байт`);
        nativeModuleWorking = true;
      } else {
        console.log('Тест НЕ успішний: capture() повернув null або порожній буфер');
      }
    } else {
      console.log('Метод capture() не доступний');
    }
  } catch (error) {
    console.error('Помилка при тестуванні нативного модуля:', error);
  }
}

// Генеруємо JPEG базовий кадр з текстом
function generateColorFrame(width, height, frameNumber) {
  console.log(`Генеруємо тестовий кадр #${frameNumber}, розмір ${width}x${height}`);
  
  // Створюємо буфер для JPEG-подібних даних (це не повний JPEG, але для демонстрації достатньо)
  const dataSize = width * height * 3;
  const buffer = Buffer.alloc(dataSize);
  
  // Змінюємо колір фону на основі номера кадру для анімації
  const red = Math.sin(frameNumber * 0.1) * 127 + 128;
  const green = Math.sin(frameNumber * 0.1 + 2) * 127 + 128;
  const blue = Math.sin(frameNumber * 0.1 + 4) * 127 + 128;
  
  // Заповнюємо буфер кольором
  for (let i = 0; i < dataSize; i += 3) {
    buffer[i] = red;
    buffer[i + 1] = green;
    buffer[i + 2] = blue;
  }
  
  // Створюємо текст з датою і часом
  const dateText = new Date().toLocaleTimeString();
  const testText = `Тестовий кадр #${frameNumber} | ${dateText}`;
  
  // Додаємо текст до буфера (у реальності це просто імітація, текст не видно)
  const textBuffer = Buffer.from(testText);
  const textPos = (height / 2) * width * 3 + (width / 2) * 3 - textBuffer.length;
  
  if (textPos > 0 && textPos + textBuffer.length < buffer.length) {
    textBuffer.copy(buffer, textPos);
  }
  
  // Додаємо просту JPEG-подібну обгортку (не справжній JPEG, але для тесту підійде)
  const jpegHeader = Buffer.from([
    0xFF, 0xD8, // SOI маркер
    0xFF, 0xE0, // APP0 маркер
    0x00, 0x10, // Довжина сегмента APP0
    0x4A, 0x46, 0x49, 0x46, 0x00, // JFIF\0
    0x01, 0x01, // Версія
    0x00, // Одиниці щільності
    0x00, 0x01, 0x00, 0x01, // Щільність
    0x00, 0x00 // Мініатюра
  ]);
  
  const jpegFooter = Buffer.from([0xFF, 0xD9]); // EOI маркер
  
  // Об'єднуємо все в один буфер
  return Buffer.concat([jpegHeader, buffer, jpegFooter]);
}

// Створення резервного тестового зображення
function createTestFrame() {
  frameCounter++;
  return generateColorFrame(640, 480, frameCounter);
}

// Функція захоплення кадру
function captureFrame() {
  try {
    // Якщо нативний модуль працює, використовуємо його
    if (nativeModuleWorking && captureModule) {
      const frame = captureModule.capture();
      if (frame && frame.length > 0) {
        console.log(`Отримано кадр з нативного модуля, розмір: ${frame.length} байт`);
        return frame;
      } else {
        console.log('Нативний модуль повернув null, використовуємо резервний метод...');
      }
    }
    
    // Якщо не вдалося отримати кадр, генеруємо тестове зображення
    const testFrame = createTestFrame();
    console.log(`Згенеровано тестовий кадр, розмір: ${testFrame.length} байт`);
    return testFrame;
  } catch (error) {
    console.error('Помилка при захопленні кадру:', error);
    
    // У випадку помилки також повертаємо тестове зображення
    return createTestFrame();
  }
}

// Статичні файли
app.use(express.static(path.join(__dirname, '..')));

// Маршрут головної сторінки
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// API маршрут для статусу
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    clients: clients.size,
    uptime: Math.floor((Date.now() - stats.startTime) / 1000),
    framesSent: stats.framesSent,
    lastFrameSize: stats.lastFrameSize,
    isCapturing,
    usingNativeModule: nativeModuleWorking
  });
});

// WebSocket підключення
wss.on('connection', (ws, req) => {
  const clientId = Date.now().toString();
  clients.set(clientId, { ws, lastActivity: Date.now() });
  
  console.log(`Новий клієнт підключено (${clientId}). Всього клієнтів: ${clients.size}`);
  console.log(`IP клієнта: ${req.socket.remoteAddress}`);
  
  // Якщо це перший клієнт, починаємо захоплення
  if (clients.size === 1 && !isCapturing) {
    startCapturing();
  }
  
  // Обробка повідомлень
  ws.on('message', (message) => {
    try {
      if (Buffer.isBuffer(message)) {
        console.log(`Отримано бінарне повідомлення від клієнта ${clientId}, розмір: ${message.length}`);
        return;
      }
      
      // Спроба розпарсити як JSON
      const data = JSON.parse(message.toString());
      console.log('Отримано повідомлення:', data);
      
      // Оновлюємо час останньої активності
      const client = clients.get(clientId);
      if (client) {
        client.lastActivity = Date.now();
      }
      
      // Обробка команди конфігурації
      if (data.command === 'config') {
        if (data.fps) config.fps = data.fps;
        if (data.quality) config.quality = data.quality;
        if (data.scale) config.scale = data.scale;
        
        console.log('Оновлено конфігурацію:', config);
        
        // Перезапуск захоплення з новими параметрами
        if (isCapturing) {
          stopCapturing();
          startCapturing();
        }
      }
      
      // Відправляємо відповідь на команду
      ws.send(JSON.stringify({
        type: 'response',
        command: data.command || 'unknown',
        status: 'success'
      }));
    } catch (e) {
      // Якщо не JSON, ігноруємо
      console.error('Помилка обробки повідомлення:', e);
    }
  });
  
  // Обробка закриття з'єднання
  ws.on('close', () => {
    clients.delete(clientId);
    console.log(`Клієнт ${clientId} відключився. Залишилося клієнтів: ${clients.size}`);
    
    // Якщо клієнтів не залишилося, зупиняємо захоплення
    if (clients.size === 0 && isCapturing) {
      stopCapturing();
    }
  });
  
  // Обробка помилок
  ws.on('error', (error) => {
    console.error(`Помилка WebSocket для клієнта ${clientId}:`, error);
    clients.delete(clientId);
  });
  
  // Відправляємо початкову інформацію клієнту
  ws.send(JSON.stringify({
    type: 'welcome',
    serverId: 'ScreenCaptureServer',
    clientId: clientId,
    config,
    timestamp: Date.now()
  }));
  
  // Відправляємо перший кадр відразу після підключення
  try {
    const initialFrame = captureFrame();
    if (initialFrame) {
      console.log(`Відправляємо перший кадр новому клієнту, розмір: ${initialFrame.length} байт`);
      ws.send(initialFrame);
      stats.framesSent++;
      stats.lastFrameSize = initialFrame.length;
    }
  } catch (error) {
    console.error('Помилка при відправці першого кадру:', error);
  }
});

// Відправка кадру всім клієнтам
function broadcastFrame(frame) {
  if (clients.size === 0) return;
  
  console.log(`Розсилання кадру ${clients.size} клієнтам, розмір: ${frame.length} байт`);
  
  let sentCount = 0;
  let errorCount = 0;
  
  clients.forEach((client, clientId) => {
    try {
      // Перевіряємо стан підключення
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(frame, { binary: true }, (err) => {
          if (err) {
            console.error(`Помилка відправки кадру клієнту ${clientId}:`, err);
            errorCount++;
          } else {
            sentCount++;
          }
        });
      }
    } catch (err) {
      console.error(`Помилка при відправці кадру клієнту ${clientId}:`, err);
      errorCount++;
    }
  });
  
  stats.framesSent++;
  stats.lastFrameSize = frame.length;
  
  // Логуємо статистику кожні 10 кадрів
  if (stats.framesSent % 10 === 0) {
    console.log(`Відправлено ${stats.framesSent} кадрів, останній розмір: ${frame.length} байт`);
    console.log(`Успішно відправлено: ${sentCount}, помилок: ${errorCount}`);
  }
}

// Початок захоплення
function startCapturing() {
  if (isCapturing) return;
  
  console.log('Запуск захоплення екрану...');
  isCapturing = true;
  
  // Інтервал захоплення
  const interval = Math.max(1000 / config.fps, 100); // Мінімум 100мс
  
  captureInterval = setInterval(() => {
    if (clients.size === 0) {
      return;
    }
    
    try {
      const frame = captureFrame();
      if (frame && frame.length > 0) {
        broadcastFrame(frame);
      } else {
        console.error('Отримано порожній кадр, пропускаємо');
      }
    } catch (error) {
      console.error('Помилка при обробці кадру:', error);
    }
  }, interval);
  
  console.log(`Захоплення запущено з інтервалом ${interval}мс (${config.fps} FPS)`);
}

// Зупинка захоплення
function stopCapturing() {
  if (!isCapturing) return;
  
  console.log('Зупинка захоплення екрану...');
  
  if (captureInterval) {
    clearInterval(captureInterval);
    captureInterval = null;
  }
  
  isCapturing = false;
  console.log('Захоплення зупинено');
}

// Запуск сервера
server.listen(PORT, () => {
  console.log(`Сервер запущено на порту ${PORT}`);
  console.log(`Відкрийте http://localhost:${PORT} у браузері для перегляду`);
  
  // Перевіряємо стан сокетів кожні 30 секунд
  setInterval(() => {
    const now = Date.now();
    let inactiveCount = 0;
    
    clients.forEach((client, clientId) => {
      // Якщо клієнт неактивний більше 5 хвилин, відключаємо його
      if (now - client.lastActivity > 5 * 60 * 1000) {
        console.log(`Закриття неактивного з'єднання клієнта ${clientId}`);
        try {
          client.ws.terminate();
          clients.delete(clientId);
          inactiveCount++;
        } catch (error) {
          console.error(`Помилка при закритті з'єднання:`, error);
        }
      }
    });
    
    if (inactiveCount > 0) {
      console.log(`Видалено ${inactiveCount} неактивних з'єднань`);
    }
  }, 30000);
});
