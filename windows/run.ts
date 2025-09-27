import { createScreenCapture, ScreenCapture } from './screen-capture';
import WebSocket from 'ws';
import { 
  WSMessage,
  WSMessageType,
  WSActionType,
  WSControlMessage,
  WSInfoMessage,
  WSMetricsMessage,
  WSFrameMessage,
  ScreenCaptureConfig,
  PerformanceMetrics
} from './types';

// Інтерфейс конфігурації
interface AppConfig {
    wsUrl: string;
    port: number;
    targetFPS: number;
    quality: number;
    resolutionScale: number;
    changeThreshold: number;
    minFrameTime: number;
    maxFrameTime: number;
}

// Отримуємо функції з нативного модуля
let screenCapture: ScreenCapture | null = createScreenCapture();
let ws: WebSocket | null = null;
let captureInterval: NodeJS.Timeout | null = null;
let hasActiveClients: boolean = false;

// Конфігурація за замовчуванням
const CONFIG: AppConfig = {
    wsUrl: 'ws://localhost:3003',
    port: 3003,
    targetFPS: 30,
    quality: 80,
    resolutionScale: 1,
    changeThreshold: 0.1,
    minFrameTime: 33, // ~30 FPS
    maxFrameTime: 1000 // 1 FPS
};

// Функція для логування
function logEvent(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  console.log(logMessage);
}

// Функція для підключення до бекенду
async function connectToBackend(): Promise<void> {
  try {
    logEvent(`Спроба підключення до ${CONFIG.wsUrl}`);
    ws = new WebSocket(CONFIG.wsUrl);

    ws.on('open', () => {
      logEvent('Підключено до бекенду');
      hasActiveClients = true;
      if (screenCapture) {
        screenCapture.setActiveClients(true);
        screenCapture.setTargetFPS(CONFIG.targetFPS);
        screenCapture.setQuality(CONFIG.quality);
        screenCapture.setResolutionScale(CONFIG.resolutionScale);
        screenCapture.setChangeThreshold(CONFIG.changeThreshold);
      }
      startCapture();
    });

    ws.on('close', () => {
      logEvent('Відключено від бекенду');
      hasActiveClients = false;
      if (screenCapture) {
        screenCapture.setActiveClients(false);
      }
      stopCapture();
    });

    ws.on('error', (error) => {
      logEvent(`Помилка WebSocket: ${error.message || error}`, 'error');
      if (error instanceof Error) {
        logEvent(`Деталі помилки: ${error.stack}`, 'error');
      }
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString()) as WSMessage;
        handleMessage(message);
      } catch (error) {
        logEvent(`Помилка обробки повідомлення: ${error}`, 'error');
      }
    });
  } catch (error) {
    logEvent(`Помилка підключення до бекенду: ${error}`, 'error');
    if (error instanceof Error) {
      logEvent(`Деталі помилки: ${error.stack}`, 'error');
    }
  }
}

// Функція для обробки повідомлень
function handleMessage(message: WSMessage): void {
  switch (message.type) {
    case 'control':
      handleControlMessage(message as WSControlMessage);
      break;
    case 'info':
      handleInfoMessage(message as WSInfoMessage);
      break;
    default:
      logEvent(`Невідомий тип повідомлення: ${message.type}`, 'warn');
  }
}

// Функція для обробки контрольних повідомлень
function handleControlMessage(message: WSControlMessage): void {
  switch (message.action) {
    case 'start':
      startCapture();
      break;
    case 'stop':
      stopCapture();
      break;
    default:
      logEvent(`Невідома дія: ${message.action}`, 'warn');
  }
}

// Функція для обробки інформаційних повідомлень
function handleInfoMessage(message: WSInfoMessage): void {
  logEvent(`Отримано інформаційне повідомлення: ${message.status}`);
}

// Функція для ініціалізації захоплення
function initializeCapture(): boolean {
  try {
    if (!screenCapture) {
      logEvent('Помилка: screenCapture не ініціалізовано', 'error');
      return false;
    }

    const screenSize = screenCapture.getScreenSize();
    if (!screenSize) {
      logEvent('Помилка: не вдалося отримати розмір екрану', 'error');
      return false;
    }

    logEvent(`Розмір екрану: ${screenSize.width}x${screenSize.height}`);
    return true;
  } catch (error) {
    logEvent(`Помилка ініціалізації захоплення: ${error}`, 'error');
    return false;
  }
}

// Функція для запуску захоплення
async function startCapture(): Promise<() => void> {
  if (!initializeCapture()) {
    logEvent('Failed to initialize capture', 'error');
    return () => {};
  }

  if (captureInterval) {
    clearInterval(captureInterval);
  }

  let lastFrameTime = Date.now();
  let frameCount = 0;
  const targetFrameTime = 1000 / CONFIG.targetFPS;
  let consecutiveErrors = 0;
  let isCapturing = true;
  let capturePromise: Promise<void> | null = null;

  const captureFrame = async () => {
    if (!isCapturing) return;

    try {
      if (!ws || !hasActiveClients || !screenCapture) {
        logEvent('Capture prerequisites not met, waiting...', 'warn');
        await new Promise(resolve => setTimeout(resolve, 1000));
        scheduleNextFrame();
        return;
      }

      if (ws.readyState !== WebSocket.OPEN) {
        logEvent('WebSocket not open, attempting to reconnect...', 'warn');
        await connectToBackend();
        scheduleNextFrame();
        return;
      }

      const currentTime = Date.now();
      const elapsed = currentTime - lastFrameTime;

      if (elapsed >= targetFrameTime) {
        const frame = screenCapture.capture();
        
        if (!frame) {
          logEvent('No frame captured, retrying...', 'warn');
          scheduleNextFrame();
          return;
        }

        // Надсилаємо бінарні дані напряму
        await new Promise<void>((resolve, reject) => {
          ws!.send(frame, (error) => {
            if (error) {
              logEvent(`Error sending frame: ${error}`, 'error');
              consecutiveErrors++;
              reject(error);
            } else {
              lastFrameTime = currentTime;
              frameCount++;
              
              // Log every 30 frames
              if (frameCount % 30 === 0) {
                logEvent(`Frames sent: ${frameCount}, Current FPS: ${1000 / elapsed}`);
              }
              
              consecutiveErrors = 0;
              resolve();
            }
          });
        });
      }
    } catch (error) {
      consecutiveErrors++;
      logEvent(`Error capturing frame: ${error}`, 'error');
      
      // If we get too many consecutive errors, pause capture briefly
      if (consecutiveErrors > 10) {
        logEvent('Too many consecutive errors, pausing capture for 2 seconds', 'warn');
        await new Promise(resolve => setTimeout(resolve, 2000));
        consecutiveErrors = 0;
      }
    }

    scheduleNextFrame();
  };

  const scheduleNextFrame = () => {
    if (hasActiveClients && isCapturing) {
      const nextDelay = Math.max(1, targetFrameTime - (Date.now() - lastFrameTime));
      capturePromise = new Promise(resolve => {
        setTimeout(async () => {
          await captureFrame();
          resolve();
        }, nextDelay);
      });
    }
  };

  // Start the capture loop
  scheduleNextFrame();

  // Return a cleanup function
  return () => {
    isCapturing = false;
    if (capturePromise) {
      capturePromise.then(() => {
        logEvent('Capture loop stopped');
      });
    }
  };
}

// Функція для зупинки захоплення
function stopCapture(): void {
  if (captureInterval) {
    clearInterval(captureInterval);
    captureInterval = null;
  }
}

// Функція для очищення ресурсів
function cleanupResources(): void {
  stopCapture();
  if (ws) {
    ws.close();
    ws = null;
  }
  if (screenCapture) {
    screenCapture.setActiveClients(false);
  }
}

// Обробка сигналів завершення
process.on('SIGINT', () => {
  logEvent('Received SIGINT signal, cleaning up...');
  cleanupResources();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logEvent('Received SIGTERM signal, cleaning up...');
  cleanupResources();
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  logEvent(`Uncaught exception: ${error}`, 'error');
  cleanupResources();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logEvent(`Unhandled rejection at: ${promise}, reason: ${reason}`, 'error');
  cleanupResources();
  process.exit(1);
});

// Запуск програми
logEvent('Запуск програми');
connectToBackend().catch((error) => {
  logEvent(`Failed to connect to backend: ${error}`, 'error');
  process.exit(1);
}); 