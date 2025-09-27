// Головний сервер захоплення екрану з підтримкою автоматичного відновлення
import * as http from 'http';
import express from 'express';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { initializeCaptureModule, captureFrame, setConfig, getConfig, setActiveClients } from './capture-fix';

// Порт для сервера
const PORT = process.env.PORT || 3000;

// Створюємо Express додаток
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Клієнти
const clients: Record<string, WebSocket.WebSocket> = {};
let clientCount = 0;
let isCapturing = false;
let captureInterval: NodeJS.Timeout | null = null;

// Типи клієнтів
enum ClientType {
  VIEWER = 'viewer',
  CAPTURER = 'capturer'
}

// Статистика
const stats = {
  framesSent: 0,
  startTime: Date.now(),
  bytesTransferred: 0,
  framesReceived: 0,
  lastFrameSize: 0,
  currentFPS: 0,
  lastFrameTime: Date.now()
};

// Ініціалізуємо модуль захоплення екрану
console.log('Ініціалізація модуля захоплення...');
if (!initializeCaptureModule()) {
  console.error('Помилка ініціалізації модуля захоплення, але продовжуємо роботу з резервним генератором...');
}

// Статичні файли
app.use(express.static(path.join(__dirname, '../..')));

// Маршрут головної сторінки
app.get('/', (req: express.Request, res: express.Response) => {
  res.sendFile(path.join(__dirname, '../..', 'index.html'));
});

// Статус сервера
app.get('/api/status', (req: express.Request, res: express.Response) => {
  const uptime = Math.floor((Date.now() - stats.startTime) / 1000);
  res.json({
    status: 'running',
    clients: clientCount,
    uptime,
    frames: stats.framesSent,
    isCapturing,
    lastFrameSize: stats.lastFrameSize,
    currentFPS: stats.currentFPS.toFixed(2),
    config: getConfig()
  });
});

// WebSocket підключення
wss.on('connection', (ws) => {
  // Генеруємо ID для клієнта
  const clientId = uuidv4();
  clients[clientId] = ws;
  clientCount++;
  
  console.log(`Новий клієнт підключено (${clientId}). Всього клієнтів: ${clientCount}`);
  
  // Оновлюємо кількість активних клієнтів
  setActiveClients(clientCount);
  
  // Якщо це перший клієнт, починаємо захоплення
  if (clientCount === 1 && !isCapturing) {
    startCapturing();
  }
  
  // Обробка повідомлень від клієнта
  ws.on('message', (message) => {
    try {
      // Якщо повідомлення бінарне, вважаємо його кадром відео
      if (Buffer.isBuffer(message)) {
        console.log(`Отримано бінарне повідомлення від клієнта ${clientId}, розмір: ${message.length} байт`);
        stats.framesReceived++;
        stats.lastFrameSize = message.length;
        
        // Розсилаємо всім іншим клієнтам
        broadcastFrame(message, clientId);
        return;
      }
      
      // Інакше очікуємо JSON
      const data = JSON.parse(message.toString());
      console.log(`Отримано повідомлення від клієнта ${clientId}:`, data);
      
      // Обробка команд
      if (data.command === 'config') {
        const newConfig = {
          quality: data.quality !== undefined ? data.quality : getConfig().quality,
          scale: data.scale !== undefined ? data.scale : getConfig().scale,
          fps: data.fps !== undefined ? data.fps : getConfig().fps,
          interval: data.interval !== undefined ? data.interval : getConfig().interval
        };
        
        setConfig(newConfig);
        console.log(`Оновлено конфігурацію:`, newConfig);
        
        // Перезапускаємо захоплення з новими параметрами
        if (isCapturing) {
          stopCapturing();
          startCapturing();
        }
      }
    } catch (err) {
      console.error(`Помилка при обробці повідомлення від клієнта ${clientId}:`, err);
    }
  });
  
  // Обробка закриття з'єднання
  ws.on('close', () => {
    delete clients[clientId];
    clientCount--;
    console.log(`Клієнт ${clientId} відключився. Залишилося клієнтів: ${clientCount}`);
    
    // Оновлюємо кількість активних клієнтів
    setActiveClients(clientCount);
    
    // Якщо не залишилося клієнтів, зупиняємо захоплення
    if (clientCount === 0 && isCapturing) {
      stopCapturing();
    }
  });
  
  // Відправляємо поточну конфігурацію клієнту
  ws.send(JSON.stringify({
    type: 'config',
    config: getConfig()
  }));
});

// Функція розсилки кадру всім клієнтам
function broadcastFrame(frame: Buffer, excludeClientId?: string): void {
  if (clientCount === 0) return;
  
  for (const clientId in clients) {
    if (excludeClientId && clientId === excludeClientId) continue;
    
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
  
  const config = getConfig();
  // Інтервал захоплення в мілісекундах
  const interval = Math.max(1000 / config.fps, 100); // Мінімум 100мс
  
  captureInterval = setInterval(() => {
    if (clientCount === 0) {
      console.log('Немає клієнтів, пауза захоплення');
      return;
    }
    
    try {
      const startTime = Date.now();
      const frame = captureFrame();
      
      if (frame && frame.length > 0) {
        stats.lastFrameSize = frame.length;
        // Вираховуємо поточний FPS
        const captureTime = Date.now() - startTime;
        stats.currentFPS = 1000 / (Date.now() - stats.lastFrameTime);
        stats.lastFrameTime = Date.now();
        
        // Логуємо статистику кожні 30 кадрів
        if (stats.framesSent % 30 === 0) {
          console.log(`FPS: ${stats.currentFPS.toFixed(2)}, розмір кадру: ${Math.round(frame.length / 1024)} KB, час захоплення: ${captureTime}мс`);
        }
        
        broadcastFrame(frame);
      } else {
        console.error('Отримано порожній кадр');
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
