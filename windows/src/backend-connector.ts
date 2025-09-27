// Модуль для з'єднання з бекендом
import WebSocket from 'ws';
import * as http from 'http';
import { ServerMetrics } from './types';

// URL бекенду за замовчуванням
const DEFAULT_BACKEND_URL = 'ws://localhost:3001';

// Статус з'єднання
let backendConnection: WebSocket | null = null;
let isConnected = false;
let reconnectTimer: NodeJS.Timeout | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_INTERVAL = 3000; // 3 секунди між спробами

/**
 * Підключення до бекенду
 */
export function connectToBackend(backendUrl: string = DEFAULT_BACKEND_URL): void {
  if (isConnected) {
    console.log('Вже підключено до бекенду');
    return;
  }
  
  try {
    console.log(`Спроба підключення до бекенду: ${backendUrl}`);
    
    // Створюємо нове підключення WebSocket
    const ws = new WebSocket(backendUrl);
    
    // Обробка відкриття з'єднання
    ws.on('open', () => {
      console.log('Успішно підключено до бекенду');
      isConnected = true;
      backendConnection = ws;
      reconnectAttempts = 0;
      
      // Ідентифікуємо себе як джерело відеопотоку
      ws.send(JSON.stringify({
        type: 'identify',
        role: 'screen-capture-source',
        deviceInfo: {
          hostname: require('os').hostname(),
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.version
        }
      }));
    });
    
    // Обробка повідомлень від бекенду
    ws.on('message', (message: WebSocket.RawData) => {
      try {
        if (Buffer.isBuffer(message)) {
          console.log(`Отримано бінарне повідомлення від бекенду, розмір: ${message.length} байт`);
          return;
        }
        
        const data = JSON.parse(message.toString());
        console.log('Отримано повідомлення від бекенду:', data.type);
        
        // Обробка команд від бекенду
        if (data.type === 'command') {
          handleBackendCommand(data);
        }
      } catch (err) {
        console.error('Помилка при обробці повідомлення від бекенду:', err);
      }
    });
    
    // Обробка закриття з'єднання
    ws.on('close', () => {
      console.log('З\'єднання з бекендом закрито');
      isConnected = false;
      backendConnection = null;
      
      // Спроба повторного підключення
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectTimer = setTimeout(() => {
          reconnectAttempts++;
          console.log(`Спроба повторного підключення ${reconnectAttempts} з ${MAX_RECONNECT_ATTEMPTS}`);
          connectToBackend(backendUrl);
        }, RECONNECT_INTERVAL);
      } else {
        console.error(`Досягнуто максимальну кількість спроб підключення (${MAX_RECONNECT_ATTEMPTS})`);
      }
    });
    
    // Обробка помилок
    ws.on('error', (err: Error) => {
      console.error('Помилка з\'єднання з бекендом:', err);
      
      // Закриваємо з'єднання при помилці, якщо воно відкрите
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });
  } catch (error) {
    console.error('Помилка при створенні з\'єднання з бекендом:', error);
  }
}

/**
 * Відправка кадру на бекенд
 */
export function sendFrameToBackend(frameData: Buffer): boolean {
  if (!isConnected || !backendConnection) {
    return false;
  }
  
  try {
    if (backendConnection.readyState === WebSocket.OPEN) {
      backendConnection.send(frameData, { binary: true }, (err?: Error) => {
        if (err) {
          console.error('Помилка відправки кадру на бекенд:', err);
        }
      });
      return true;
    }
  } catch (err) {
    console.error('Помилка відправки кадру на бекенд:', err);
  }
  
  return false;
}

/**
 * Відправка метрик на бекенд
 */
export function sendMetricsToBackend(metrics: ServerMetrics): boolean {
  if (!isConnected || !backendConnection) {
    return false;
  }
  
  try {
    if (backendConnection.readyState === WebSocket.OPEN) {
      backendConnection.send(JSON.stringify({
        type: 'metrics',
        data: metrics
      }));
      return true;
    }
  } catch (err) {
    console.error('Помилка відправки метрик на бекенд:', err);
  }
  
  return false;
}

/**
 * Обробка команд від бекенду
 */
function handleBackendCommand(data: any): void {
  if (!data.command) {
    console.error('Отримано команду без поля command');
    return;
  }
  
  switch (data.command) {
    case 'start-capture':
      console.log('Отримано команду start-capture від бекенду');
      // Тут потрібно викликати функцію запуску захоплення
      // startCapture();
      break;
      
    case 'stop-capture':
      console.log('Отримано команду stop-capture від бекенду');
      // Тут потрібно викликати функцію зупинки захоплення
      // stopCapture();
      break;
      
    case 'update-config':
      console.log('Отримано команду update-config від бекенду:', data.config);
      // Тут потрібно оновити конфігурацію
      // setConfig(data.config);
      break;
      
    default:
      console.log(`Отримано невідому команду від бекенду: ${data.command}`);
  }
}

/**
 * Відключення від бекенду
 */
export function disconnectFromBackend(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  
  if (backendConnection) {
    try {
      backendConnection.close();
      backendConnection = null;
      isConnected = false;
      console.log('Відключено від бекенду');
    } catch (err) {
      console.error('Помилка відключення від бекенду:', err);
    }
  }
}
