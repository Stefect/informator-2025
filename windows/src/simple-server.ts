// Спрощений сервер для захоплення екрану
import * as http from 'http';
import express from 'express';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as WebSocket from 'ws';

// Порт для сервера
const PORT = process.env.PORT || 3000;

// Створюємо Express додаток
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Клієнти
const clients: { [id: string]: WebSocket.WebSocket } = {};
let clientCount = 0;
let isCapturing = false;
let captureInterval: NodeJS.Timeout | null = null;

// Статистика
const stats = {
  framesSent: 0,
  startTime: Date.now(),
  bytesTransferred: 0
};

// Налаштування для захоплення
const config = {
  fps: 3,
  quality: 80,
  scale: 1.0
};

// Тут буде код завантаження модуля захоплення екрану
let captureModule: any = null;

try {
  // Спроба завантажити GDI модуль захоплення
  console.log('Спроба завантаження модуля захоплення екрану...');
  
  // Шляхи до можливих модулів
  const modulePaths = [
    './build/Release/gdi_screen_capture.node',
    './gdi_screen_capture.node',
    './build/Release/screencapture.node',
    './screencapture.node'
  ];
  
  // Перебираємо можливі шляхи
  for (const modulePath of modulePaths) {
    try {
      const fullPath = path.join(process.cwd(), modulePath);
      console.log(`Спроба завантаження: ${fullPath}`);
      if (fs.existsSync(fullPath)) {
        console.log(`Файл знайдено: ${fullPath}`);
        captureModule = require(fullPath);
        
        if (captureModule) {
          console.log('Модуль успішно завантажено');
          
          // Перевіряємо наявні методи
          console.log('Доступні методи модуля:');
          for (const method of Object.keys(captureModule)) {
            console.log(`- ${method}`);
          }
          
          break;
        }
      } else {
        console.log(`Файл не знайдено: ${fullPath}`);
      }
    } catch (err) {
      console.error(`Помилка при завантаженні модуля ${modulePath}:`, err);
    }
  }
  
  if (!captureModule) {
    throw new Error('Не вдалося завантажити жоден з модулів захоплення екрану');
  }
  
  // Тестуємо функції захоплення
  console.log('Тестування функцій захоплення...');
  if (typeof captureModule.captureScreen === 'function') {
    console.log('Тест captureScreen...');
    const testFrame = captureModule.captureScreen(80, 1.0);
    console.log(`Результат captureScreen: ${testFrame ? 'OK' : 'помилка'}`);
    if (testFrame) {
      console.log(`Розмір кадру: ${testFrame.length} байт`);
    }
  }
  
  if (typeof captureModule.capture === 'function') {
    console.log('Тест capture...');
    const testFrame = captureModule.capture();
    console.log(`Результат capture: ${testFrame ? 'OK' : 'помилка'}`);
    if (testFrame) {
      console.log(`Розмір кадру: ${testFrame.length} байт`);
    }
  }
} catch (error) {
  console.error('Помилка при ініціалізації модуля захоплення:', error);
}

// Функція захоплення кадру
function captureFrame(): Buffer | null {
  if (!captureModule) {
    console.error('Модуль захоплення не ініціалізовано');
    return null;
  }
  
  try {
    let frame: Buffer | null = null;
    
    // Спробуємо використати метод captureScreen
    if (typeof captureModule.captureScreen === 'function') {
      frame = captureModule.captureScreen(config.quality, config.scale);
    } 
    // Або метод capture, якщо captureScreen недоступний
    else if (typeof captureModule.capture === 'function') {
      frame = captureModule.capture();
    }
    
    if (!frame) {
      console.error('Помилка при захопленні екрану: отримано null замість кадру');
      return null;
    }
    
    return frame;
  } catch (err) {
    console.error('Помилка при захопленні екрану:', err);
    return null;
  }
}

// Статичні файли
app.use(express.static(path.join(__dirname, '../..')));

// Маршрут головної сторінки
app.get('/', (req: express.Request, res: express.Response) => {
  res.sendFile(path.join(__dirname, '../..', 'index.html'));
});

// Статус сервера
app.get('/status', (req: express.Request, res: express.Response) => {
  const uptime = Math.floor((Date.now() - stats.startTime) / 1000);
  res.json({
    status: 'running',
    clients: clientCount,
    uptime,
    frames: stats.framesSent,
    isCapturing
  });
});

// WebSocket підключення
wss.on('connection', (ws) => {
  // Генеруємо ID для клієнта
  const clientId = Date.now().toString();
  clients[clientId] = ws;
  clientCount++;
  
  console.log(`Новий клієнт підключено. Всього клієнтів: ${clientCount}`);
  
  // Якщо це перший клієнт, починаємо захоплення
  if (clientCount === 1 && !isCapturing) {
    startCapturing();
  }
  
  // Обробка повідомлень від клієнта
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log(`Отримано повідомлення від клієнта:`, data);
      
      // Обробка команд
      if (data.command === 'config') {
        if (data.fps) config.fps = data.fps;
        if (data.quality) config.quality = data.quality;
        if (data.scale) config.scale = data.scale;
        
        console.log(`Оновлено конфігурацію: FPS=${config.fps}, якість=${config.quality}, масштаб=${config.scale}`);
        
        // Перезапускаємо захоплення з новими параметрами
        if (isCapturing) {
          stopCapturing();
          startCapturing();
        }
      }
    } catch (err) {
      console.error('Помилка при обробці повідомлення від клієнта:', err);
    }
  });
  
  // Обробка закриття з'єднання
  ws.on('close', () => {
    delete clients[clientId];
    clientCount--;
    console.log(`Клієнт відключився. Залишилося клієнтів: ${clientCount}`);
    
    // Якщо не залишилося клієнтів, зупиняємо захоплення
    if (clientCount === 0 && isCapturing) {
      stopCapturing();
    }
  });
  
  // Відправляємо поточну конфігурацію клієнту
  ws.send(JSON.stringify({
    type: 'config',
    fps: config.fps,
    quality: config.quality,
    scale: config.scale
  }));
});

// Функція розсилки кадру всім клієнтам
function broadcastFrame(frame: Buffer): void {
  if (clientCount === 0) return;
  
  for (const clientId in clients) {
    try {
      const client = clients[clientId];
      if (client.readyState === WebSocket.OPEN) {
        client.send(frame);
        stats.framesSent++;
        stats.bytesTransferred += frame.length;
      }
    } catch (err) {
      console.error(`Помилка при відправці кадру клієнту ${clientId}:`, err);
    }
  }
}

// Запуск захоплення
function startCapturing(): void {
  if (isCapturing) return;
  
  console.log('Запуск захоплення екрану...');
  isCapturing = true;
  
  // Інтервал захоплення в мілісекундах
  const interval = Math.max(1000 / config.fps, 100); // Мінімум 100мс
  
  captureInterval = setInterval(() => {
    if (clientCount === 0) {
      console.log('Немає клієнтів, пауза захоплення');
      return;
    }
    
    try {
      const frame = captureFrame();
      if (frame) {
        broadcastFrame(frame);
      }
    } catch (err) {
      console.error('Помилка при захопленні і відправці кадру:', err);
    }
  }, interval);
  
  console.log(`Захоплення екрану запущено з інтервалом ${interval}мс (${config.fps} FPS)`);
}

// Зупинка захоплення
function stopCapturing(): void {
  if (!isCapturing) return;
  
  console.log('Зупинка захоплення екрану...');
  
  if (captureInterval) {
    clearInterval(captureInterval);
    captureInterval = null;
  }
  
  isCapturing = false;
  console.log('Захоплення екрану зупинено');
}

// Запуск сервера
server.listen(PORT, () => {
  console.log(`Сервер запущено на порту ${PORT}`);
  console.log(`Відкрийте http://localhost:${PORT} у браузері для перегляду`);
});

// Обробка помилок
process.on('uncaughtException', (err) => {
  console.error('Необроблена помилка:', err);
});

process.on('SIGINT', () => {
  console.log('Отримано сигнал завершення, закриття сервера...');
  stopCapturing();
  server.close(() => {
    console.log('Сервер закрито');
    process.exit(0);
  });
});
