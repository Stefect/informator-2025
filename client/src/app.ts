// Головний файл для додатку захоплення екрану
import express from 'express';
import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { initializeCapture } from './screen-capture';
import { initWebSocketServer } from './websocket-server';

// Порт, на якому буде працювати сервер
const PORT = process.env.PORT || 3000;

// Збільшуємо ліміт для стеків помилок
Error.stackTraceLimit = 30;

// Логування важливих подій
console.log(`Запуск серверу захоплення екрану, версія Node.js: ${process.version}`);
console.log(`Операційна система: ${os.platform()} ${os.release()}`);

// Додаємо обробники необроблених помилок
process.on('uncaughtException', (err: Error) => {
  console.error('Необроблена помилка:', err);
  console.error('Стек помилки:', err.stack);
});

process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  console.error('Необроблена відхилена обіцянка:', reason);
  if (reason instanceof Error) {
    console.error('Стек помилки:', reason.stack);
  }
});

// Запобігання аварійному завершенню при помилці
process.on('exit', (code: number) => {
  console.log(`Процес завершується з кодом: ${code}`);
});

// Перехоплюємо завершення роботи
process.on('SIGINT', () => {
  console.log('Отримано сигнал SIGINT, завершення роботи...');
  process.exit(0);
});

// Ініціалізація модуля захоплення екрану
if (!initializeCapture()) {
  console.error('Не вдалося ініціалізувати модуль захоплення екрану, програма буде завершена');
  process.exit(1);
}

// Ініціалізація Express додатку
const app = express();
const server = http.createServer(app);

// Доступ до статичних файлів
app.use(express.static(path.join(__dirname, '../..')));

// Перевіряємо директорію
try {
  const staticPath = path.join(__dirname, '../..');
  console.log(`Перевіряємо директорію статичних файлів: ${staticPath}`);
  const files = fs.readdirSync(staticPath);
  console.log(`Знайдено файлів: ${files.length}`);
  console.log(`Файли: ${files.join(', ')}`);
} catch (err) {
  console.error('Помилка при читанні директорії:', err);
}

// Маршрут головної сторінки
app.get('/', (req: express.Request, res: express.Response) => {
  try {
    const indexPath = path.join(__dirname, '../..', 'index.html');
    console.log(`Запит до головної сторінки, шлях: ${indexPath}`);
    
    if (fs.existsSync(indexPath)) {
      console.log('Файл index.html існує, відправляємо');
      res.sendFile(indexPath);
    } else {
      console.error('Файл index.html не знайдено');
      res.status(404).send('Файл не знайдено');
    }
  } catch (err) {
    console.error('Помилка при обробці запиту /', err);
    res.status(500).send('Помилка сервера');
  }
});

// Маршрут для статусу сервера
app.get('/api/status', (req: express.Request, res: express.Response) => {
  res.json({
    status: 'running',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    hostname: os.hostname(),
    platform: os.platform(),
    cpuUsage: process.cpuUsage()
  });
});

// Маршрут для бекенду
app.post('/api/connect', (req: express.Request, res: express.Response) => {
  res.json({
    success: true,
    message: 'Підключено до бекенду',
    serverTime: new Date().toISOString()
  });
});

// Запуск сервера
try {
  console.log(`Спроба запуску HTTP сервера на порту ${PORT}...`);
  
  // Перевіряємо, чи порт вже використовується
  const net = require('net');
  const tester = net.createServer()
    .once('error', (err: Error & { code?: string }) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Порт ${PORT} вже використовується!`);
      } else {
        console.error('Помилка при перевірці порту:', err);
      }
      console.log('Спробуємо продовжити...');
    })
    .once('listening', () => {
      tester.close();
    })
    .listen(PORT);
  
  // Запускаємо сервер, передаючи порт як число
  const portNumber = typeof PORT === 'string' ? parseInt(PORT, 10) : PORT;
  
  server.listen(portNumber, 'localhost', () => {
    console.log(`Сервер успішно запущено на порту ${portNumber}`);
    console.log(`Веб-інтерфейс доступний за адресою: http://localhost:${portNumber}`);
    
    // Ініціалізуємо WebSocket сервер
    if (!initWebSocketServer(server)) {
      console.error('Не вдалося ініціалізувати WebSocket сервер');
    }
  });
} catch (error) {
  console.error('Критична помилка при запуску сервера:', error);
  if (error instanceof Error) {
    console.error('Стек помилки:', error.stack);
  }
  process.exit(1);
}
