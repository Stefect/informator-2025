// Модуль WebSocket сервера для передачі відеопотоку
import * as WebSocket from 'ws';
import * as http from 'http';
import { v4 as uuidv4 } from 'uuid';
import { ClientType, ClientInfo, Client, ServerMetrics, StreamMessage } from './types';
import { captureFrame, getConfig, setConfig } from './screen-capture';

// Клієнти
export const clients = {
  viewers: new Map<string, Client>(),
  capturers: new Map<string, Client>()
};

// Метрики сервера
export const metrics: ServerMetrics = {
  framesReceived: 0,
  framesSent: 0,
  startTime: Date.now(),
  currentFPS: 0,
  lastFrameTime: Date.now(),
  bytesReceived: 0,
  bytesSent: 0
};

// WebSocket сервер
let wss: WebSocket.Server | null = null;
let captureInterval: NodeJS.Timeout | null = null;
let isCapturing = false;

/**
 * Ініціалізація WebSocket сервера
 */
export function initWebSocketServer(server: http.Server): boolean {
  try {
    console.log('Ініціалізація WebSocket сервера...');
    
    wss = new WebSocket.Server({ server });
    
    // Обробка підключення нового клієнта
    wss.on('connection', handleClientConnection);
    
    console.log('WebSocket сервер успішно ініціалізовано');
    return true;
  } catch (error) {
    console.error('Помилка ініціалізації WebSocket сервера:', error);
    console.error('Стек помилки:', (error as Error).stack);
    return false;
  }
}

/**
 * Обробка підключення нового клієнта
 */
function handleClientConnection(ws: WebSocket, req: http.IncomingMessage): void {
  try {
    const clientIp = req.socket.remoteAddress || 'невідома IP';
    console.log(`Нове підключення від ${clientIp}`);
    
    // Генеруємо унікальний ідентифікатор для клієнта
    const clientId = uuidv4();
    
    // За замовчуванням вважаємо, що це глядач
    let clientType = ClientType.VIEWER;
    let clientInfo: ClientInfo = { 
      id: clientId, 
      ip: clientIp, 
      type: clientType, 
      connectedAt: new Date() 
    };
    
    // Додаємо клієнта до списку глядачів
    clients.viewers.set(clientId, { ws, info: clientInfo });
    
    console.log(`Підключено нового глядача (${clientId}), всього глядачів: ${clients.viewers.size}`);
    
    // Якщо це перший глядач, запускаємо захоплення екрану
    if (clients.viewers.size === 1 && !isCapturing) {
      startCapture();
    }
    
    // Повідомляємо клієнтів захоплення про кількість глядачів
    broadcastViewerCount();
    
    // Обробка повідомлень від клієнта
    ws.on('message', (message: WebSocket.RawData) => {
      try {
        // Якщо це бінарне повідомлення (кадр відео)
        if (Buffer.isBuffer(message)) {
          handleVideoFrame(clientId, message);
          return;
        }
        
        // Якщо це JSON повідомлення
        const data = JSON.parse(message.toString()) as StreamMessage;
        console.log(`Отримано повідомлення від клієнта ${clientId}: ${data.type}`);
        
        // Обробка різних типів повідомлень
        if (data.type === 'identify') {
          handleClientIdentification(clientId, data, ws);
        }
        else if (data.type === 'config') {
          // Оновлення конфігурації захоплення екрану
          if (data.data?.captureConfig) {
            setConfig(data.data.captureConfig);
            console.log('Оновлено конфігурацію захоплення:', getConfig());
            
            // Якщо змінюється FPS, перезапускаємо захоплення
            if (isCapturing) {
              stopCapture();
              startCapture();
            }
          }
        }
      } catch (err) {
        console.error(`Помилка обробки повідомлення від клієнта ${clientId}:`, err);
        console.error('Стек помилки:', (err as Error).stack);
      }
    });
    
    // Обробка закриття з'єднання
    ws.on('close', () => {
      console.log(`Клієнт ${clientId} від'єднався`);
      
      // Видаляємо клієнта з відповідної колекції
      if (clientType === ClientType.VIEWER) {
        clients.viewers.delete(clientId);
        console.log(`Глядач від'єднався, залишилося глядачів: ${clients.viewers.size}`);
        
        // Якщо не залишилося глядачів, зупиняємо захоплення екрану
        if (clients.viewers.size === 0 && isCapturing) {
          console.log('Немає активних глядачів, зупиняємо захоплення екрану');
          stopCapture();
        }
        
        // Повідомляємо клієнти захоплення про оновлену кількість глядачів
        broadcastViewerCount();
      } else if (clientType === ClientType.CAPTURER) {
        clients.capturers.delete(clientId);
        console.log(`Клієнт захоплення від'єднався, залишилося клієнтів захоплення: ${clients.capturers.size}`);
      }
    });
    
    // Обробка помилок
    ws.on('error', (err) => {
      console.error(`Помилка WebSocket з'єднання для клієнта ${clientId}:`, err);
      console.error('Стек помилки:', (err as Error).stack);
    });
  } catch (error) {
    console.error('Помилка при обробці нового WebSocket підключення:', error);
    console.error('Стек помилки:', (error as Error).stack);
  }
}

/**
 * Обробка ідентифікації клієнта
 */
function handleClientIdentification(clientId: string, data: StreamMessage, ws: WebSocket): void {
  console.log(`Клієнт ${clientId} ідентифікувався як ${data.data?.role}`);
  
  // Отримуємо поточного клієнта
  const client = clients.viewers.get(clientId);
  
  if (client) {
    // Визначаємо тип клієнта
    const clientType = data.data?.role === 'capture' ? ClientType.CAPTURER : ClientType.VIEWER;
    
    // Якщо це клієнт захоплення, переміщуємо його до відповідної колекції
    if (clientType === ClientType.CAPTURER) {
      clients.viewers.delete(clientId);
      
      // Оновлюємо інформацію про клієнта
      client.info.type = ClientType.CAPTURER;
      clients.capturers.set(clientId, client);
      
      console.log(`Клієнт ${clientId} переміщено до колекції клієнтів захоплення`);
      console.log(`Кількість клієнтів захоплення: ${clients.capturers.size}`);
      
      // Повідомляємо клієнта про поточну кількість глядачів
      notifyViewerCount(ws);
    }
  }
}

/**
 * Обробка кадру відео від клієнта захоплення
 */
function handleVideoFrame(clientId: string, frameData: Buffer): void {
  // Перевіряємо, чи клієнт з таким ID є в списку клієнтів захоплення
  const client = [...clients.capturers.values()].find(c => c.info.id === clientId);
  
  if (!client) {
    console.log(`Отримано кадр від невідомого клієнта захоплення: ${clientId}`);
    return;
  }
  
  console.log(`Отримано кадр від клієнта захоплення ${clientId}, розмір: ${frameData.length} байт`);
  
  // Оновлюємо метрики
  metrics.framesReceived++;
  metrics.bytesReceived += frameData.length;
  metrics.currentFPS = 1000 / (Date.now() - metrics.lastFrameTime);
  metrics.lastFrameTime = Date.now();
  
  // Пересилаємо кадр всім глядачам
  broadcastFrameToViewers(frameData);
}

/**
 * Розсилання кадру всім глядачам
 */
function broadcastFrameToViewers(frameData: Buffer): void {
  if (clients.viewers.size === 0) {
    return; // Немає глядачів
  }
  
  console.log(`Розсилання кадру ${clients.viewers.size} глядачам...`);
  
  // Розсилаємо кадр всім підключеним глядачам
  for (const [clientId, client] of clients.viewers) {
    try {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(frameData);
        metrics.framesSent++;
        metrics.bytesSent += frameData.length;
      }
    } catch (err) {
      console.error(`Помилка відправки кадру глядачу ${clientId}:`, err);
      console.error('Стек помилки:', (err as Error).stack);
    }
  }
}

/**
 * Повідомлення клієнтів захоплення про кількість глядачів
 */
function broadcastViewerCount(): void {
  for (const [clientId, client] of clients.capturers) {
    notifyViewerCount(client.ws);
  }
}

/**
 * Повідомлення окремого клієнта про кількість глядачів
 */
function notifyViewerCount(ws: WebSocket): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'viewerCount',
      count: clients.viewers.size
    }));
  }
}

/**
 * Запуск захоплення екрану
 */
export function startCapture(): void {
  if (isCapturing) {
    console.log('Захоплення екрану вже запущено');
    return;
  }
  
  console.log('Запуск захоплення екрану...');
  
  try {
    isCapturing = true;
    
    // Запускаємо інтервал захоплення екрану
    const config = getConfig();
    const interval = Math.max(1000 / config.fps, 100); // Мінімум 100мс
    console.log(`Запуск захоплення з інтервалом ${interval}мс (${config.fps} FPS)`);
    
    captureInterval = setInterval(() => {
      try {
        // Якщо немає глядачів, не захоплюємо екран
        if (clients.viewers.size === 0) {
          console.log('Немає активних глядачів, пауза захоплення екрану');
          return;
        }
        
        // Захоплюємо кадр
        const frameBuffer = captureFrame();
        
        if (frameBuffer) {
          // Розсилаємо кадр всім глядачам
          broadcastFrameToViewers(frameBuffer);
        }
      } catch (captureError) {
        console.error('Помилка при захопленні кадру:', captureError);
        console.error('Стек помилки:', (captureError as Error).stack);
      }
    }, interval);
    
    console.log('Захоплення екрану запущено');
  } catch (err) {
    console.error('Помилка при запуску захоплення екрану:', err);
    console.error('Стек помилки:', (err as Error).stack);
    isCapturing = false;
  }
}

/**
 * Зупинка захоплення екрану
 */
export function stopCapture(): void {
  if (!isCapturing) {
    console.log('Захоплення екрану вже зупинено');
    return;
  }
  
  console.log('Зупинка захоплення екрану...');
  
  if (captureInterval) {
    clearInterval(captureInterval);
    captureInterval = null;
  }
  
  isCapturing = false;
  
  console.log('Захоплення екрану зупинено');
}
