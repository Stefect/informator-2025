import { app, BrowserWindow, screen } from 'electron';
import WebSocket from 'ws';
import { createScreenCapture } from './screen-capture';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getCPUUsage, saveConfig, loadConfig, forceGarbageCollection } from './utils';

// Перевірка наявності модуля 'screencapture.node'
try {
  require('../build/Release/screencapture.node');
} catch (error) {
  console.error('Модуль screencapture.node не знайдено:', error);
}

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

// Отримуємо функції з нативного модуля
let screenCapture = createScreenCapture();
let ws: WebSocket | null = null;
let captureInterval: NodeJS.Timeout | null = null;
let hasActiveClients: boolean = false;

// Конфігурація за замовчуванням
const CONFIG: ScreenCaptureConfig = {
  port: 3000,
  jpegQuality: 85,
  resolutionScale: 1.0,
  targetFPS: 5, // Знижено для економії ресурсів
  changeThreshold: 0.05, // Підвищено для зменшення непотрібних оновлень
  minFrameTime: 200, // ~5 FPS
  maxFrameTime: 1000, // 1 FPS
  adaptiveQuality: true,
  adaptiveFPS: true,
  maxMessageSize: 1024 * 1024, // 1MB
  networkThrottling: {
    enabled: true,
    maxBitrate: 10 // 10 Mbps
  },
  memoryManagement: {
    maxBufferSize: 256 * 1024 * 1024, // Зменшено до 256MB для економії пам'яті
    gcInterval: 60000 // Запуск GC кожну хвилину
  },
  logging: {
    enabled: true,
    level: 'info',
    file: 'screen-capture.log'
  }
};

// Базові метрики
const metrics: PerformanceMetrics = {
  lastFrameTime: Date.now(),
  frameCount: 0,
  lastFpsTime: Date.now(),
  currentFps: 0,
  skipFrameCount: 0,
  cpuUsage: 0,
  memoryUsage: 0,
  networkUsage: {
    bytesSent: 0,
    bytesPerSecond: 0,
    lastUpdateTime: Date.now()
  }
};

// Глобальні змінні
let mainWindow: BrowserWindow | null = null;
let isCapturing = false;
let lastFrameTime = Date.now();
let lastQualityAdjustment = Date.now();
let lastFPSAdjustment = Date.now();
let clients = new Set<WebSocket>();
let networkUsageBuffer: number[] = [];
let gcScheduled = false;

/**
 * Логування подій
 */
function logEvent(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
  if (!CONFIG.logging.enabled) return;
  
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  
  console.log(logMessage);
  
  if (CONFIG.logging.file) {
    fs.appendFileSync(CONFIG.logging.file, logMessage + '\n');
  }
}

/**
 * Планування запуску збирача сміття для оптимізації пам'яті
 */
function scheduleGarbageCollection(): void {
  if (gcScheduled) return;
  
  gcScheduled = true;
  
  setTimeout(() => {
    forceGarbageCollection();
    gcScheduled = false;
    logEvent('Виконано планове очищення пам\'яті');
  }, CONFIG.memoryManagement.gcInterval || 60000);
}

/**
 * Підключення до бекенду через WebSocket
 */
async function connectToBackend(): Promise<void> {
  try {
    // Очищення попередніх ресурсів перед новим підключенням
    cleanupResources();

    // Використовуємо порт з конфігурації
    ws = new WebSocket(`ws://localhost:${CONFIG.port}/screencapture`);

    if (!ws) {
      throw new Error('Failed to create WebSocket connection');
    }

    ws.on('open', () => {
      logEvent('Connected to backend');
      
      // Ініціалізуємо захоплення екрану перед відправкою інформації
      if (!initializeCapture()) {
        logEvent('Failed to initialize screen capture', 'error');
        ws?.close();
        return;
      }

      // Відправляємо інформацію про клієнта
      if (ws && ws.readyState === WebSocket.OPEN) {
        const size = screenCapture.getScreenSize();
        ws.send(JSON.stringify({
          type: 'info',
          client: 'windows-screen-capture',
          version: '1.0.0',
          config: CONFIG,
          screenSize: size
        }));
      }
    });

    ws.on('message', (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'control') {
          if (data.action === 'start') {
            logEvent('Received start command from backend');
            startCapture();
          } else if (data.action === 'stop') {
            logEvent('Received stop command from backend');
            stopCapture();
          }
        }
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        logEvent(`Failed to parse message: ${error.message}`, 'error');
      }
    });

    ws.on('close', () => {
      logEvent('Disconnected from backend');
      stopCapture();
      // Спроба повторного підключення через 5 секунд
      setTimeout(connectToBackend, 5000);
    });

    ws.on('error', (error: Error) => {
      logEvent(`WebSocket error: ${error.message}`, 'error');
      stopCapture();
      // Спроба перепідключення після помилки
      setTimeout(() => {
        if (ws?.readyState === WebSocket.CLOSED) {
          logEvent('Attempting to reconnect after error...');
          connectToBackend();
        }
      }, 5000);
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logEvent(`Failed to connect: ${error.message}`, 'error');
    // Спроба повторного підключення через 5 секунд
    setTimeout(connectToBackend, 5000);
  }
}

/**
 * Ініціалізація функції захоплення екрану
 */
function initializeCapture(): boolean {
  try {
    console.log('Initializing screen capture with settings:', CONFIG);
    
    if (!screenCapture) {
      console.log('Creating new screen capture instance...');
      screenCapture = createScreenCapture();
      if (!screenCapture) {
        logEvent('Failed to create screen capture instance', 'error');
        return false;
      }
      console.log('Screen capture instance created successfully');
    }

    console.log('Getting screen size...');
    const size = screenCapture.getScreenSize();
    console.log('Received screen size:', size);

    if (!size) {
      logEvent('Screen size is null or undefined', 'error');
      return false;
    }

    if (size.width === 0 || size.height === 0) {
      logEvent(`Invalid screen dimensions: ${size.width}x${size.height}`, 'error');
      return false;
    }

    // Apply capture settings
    console.log('Applying capture settings...');
    try {
      screenCapture.setQuality(CONFIG.jpegQuality);
      console.log(`Quality set to ${CONFIG.jpegQuality}%`);
    } catch (error) {
      console.error('Failed to set quality:', error);
    }

    try {
      screenCapture.setResolutionScale(CONFIG.resolutionScale);
      console.log(`Resolution scale set to ${CONFIG.resolutionScale}`);
    } catch (error) {
      console.error('Failed to set resolution scale:', error);
    }

    try {
      screenCapture.setTargetFPS(CONFIG.targetFPS);
      console.log(`Target FPS set to ${CONFIG.targetFPS}`);
    } catch (error) {
      console.error('Failed to set target FPS:', error);
    }

    try {
      screenCapture.setChangeThreshold(CONFIG.changeThreshold);
      console.log(`Change threshold set to ${CONFIG.changeThreshold}`);
    } catch (error) {
      console.error('Failed to set change threshold:', error);
    }

    logEvent(`Screen capture initialized with size: ${size.width}x${size.height}`);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logEvent(`Failed to initialize screen capture: ${errorMessage}`, 'error');
    console.error('Detailed error:', error);
    return false;
  }
}

/**
 * Моніторинг та контроль мережевого трафіку
 */
function monitorNetworkUsage(bytesSent: number): void {
  const now = Date.now();
  const elapsed = now - metrics.networkUsage.lastUpdateTime;
  
  // Оновлення метрик лише раз на секунду
  if (elapsed >= 1000) {
    metrics.networkUsage.bytesSent += bytesSent;
    const bytesPerSecond = metrics.networkUsage.bytesSent * 1000 / elapsed;
    metrics.networkUsage.bytesPerSecond = bytesPerSecond;
    
    // Збереження останніх 10 показників для аналізу тренду
    networkUsageBuffer.push(bytesPerSecond);
    if (networkUsageBuffer.length > 10) {
      networkUsageBuffer.shift();
    }
    
    // Перевірка обмеження пропускної здатності
    const mbps = bytesPerSecond * 8 / 1024 / 1024;
    if (CONFIG.networkThrottling.enabled && mbps > CONFIG.networkThrottling.maxBitrate) {
      // Зменшення якості для обмеження трафіку
      if (CONFIG.adaptiveQuality && CONFIG.jpegQuality > 60) {
        CONFIG.jpegQuality -= 5;
        screenCapture.setQuality(CONFIG.jpegQuality);
        logEvent(`Зменшено якість до ${CONFIG.jpegQuality}% для обмеження трафіку (${mbps.toFixed(2)} Mbps)`);
      }
      
      // Зменшення FPS якщо перевищення ліміту значне
      if (CONFIG.adaptiveFPS && mbps > CONFIG.networkThrottling.maxBitrate * 1.5 && CONFIG.targetFPS > 3) {
        CONFIG.targetFPS -= 1;
        screenCapture.setTargetFPS(CONFIG.targetFPS);
        CONFIG.minFrameTime = 1000 / CONFIG.targetFPS;
        logEvent(`Зменшено FPS до ${CONFIG.targetFPS} для обмеження трафіку`);
      }
    } else if (mbps < CONFIG.networkThrottling.maxBitrate * 0.7) {
      // Маємо запас - можна поступово підвищувати якість
      const avgUsage = networkUsageBuffer.reduce((sum, val) => sum + val, 0) / networkUsageBuffer.length;
      const avgMbps = avgUsage * 8 / 1024 / 1024;
      
      // Збільшуємо якість тільки якщо середній трафік також нижче ліміту
      if (CONFIG.adaptiveQuality && avgMbps < CONFIG.networkThrottling.maxBitrate * 0.8 && CONFIG.jpegQuality < 95) {
        CONFIG.jpegQuality = Math.min(95, CONFIG.jpegQuality + 2);
        screenCapture.setQuality(CONFIG.jpegQuality);
        logEvent(`Підвищено якість до ${CONFIG.jpegQuality}%`);
      }
    }
    
    // Скидання лічильників для нового вимірювання
    metrics.networkUsage.bytesSent = 0;
    metrics.networkUsage.lastUpdateTime = now;
    
    // Планування збирання сміття при необхідності
    if (process.memoryUsage().heapUsed > CONFIG.memoryManagement.maxBufferSize) {
      scheduleGarbageCollection();
    }
  } else {
    // Просто додаємо байти до лічильника
    metrics.networkUsage.bytesSent += bytesSent;
  }
}

/**
 * Початок захоплення екрану
 */
async function startCapture(): Promise<void> {
  if (isCapturing) {
    console.log('Screen capture is already running');
    return;
  }

  try {
    if (!screenCapture) {
      if (!initializeCapture()) {
        throw new Error('Failed to initialize screen capture');
      }
    }

    const size = screenCapture.getScreenSize();
    if (!size || size.width === 0 || size.height === 0) {
      throw new Error('Invalid screen size');
    }

    isCapturing = true;
    logEvent('Starting screen capture');

    const displays = screen.getAllDisplays();
    const primaryDisplay = displays[0];

    console.log('Starting screen capture with settings:');
    console.log(`- Resolution: ${size.width}x${size.height}`);
    console.log(`- Quality: ${CONFIG.jpegQuality}%`);
    console.log(`- Scale: ${CONFIG.resolutionScale}`);
    console.log(`- Target FPS: ${CONFIG.targetFPS}`);
    console.log(`- Change threshold: ${CONFIG.changeThreshold}`);

    // Встановлюємо параметри захоплення
    screenCapture.setQuality(CONFIG.jpegQuality);
    screenCapture.setResolutionScale(CONFIG.resolutionScale);
    screenCapture.setTargetFPS(CONFIG.targetFPS);
    screenCapture.setChangeThreshold(CONFIG.changeThreshold);

    screenCapture.setActiveClients(true);

    // Створюємо інтервал для періодичного захоплення кадрів
    captureInterval = setInterval(captureAndSendFrame, CONFIG.minFrameTime);

    console.log('Screen capture started successfully');
  } catch (error) {
    console.error('Failed to start screen capture:', error);
    cleanupResources();
  }
}

/**
 * Захоплення і відправка кадру
 */
async function captureAndSendFrame(): Promise<void> {
  if (!isCapturing || !ws || ws.readyState !== WebSocket.OPEN) {
    return;
  }

  try {
    // Перевіряємо час від останнього кадру
    const now = Date.now();
    const timeSinceLastFrame = now - lastFrameTime;
    
    // Контроль FPS - пропуск кадрів при необхідності
    if (timeSinceLastFrame < CONFIG.minFrameTime) {
      return;
    }
    
    // Захоплення кадру
    const frameData = screenCapture.capture();
    
    if (!frameData || frameData.length === 0) {
      // Пустий кадр, пропускаємо
      metrics.skipFrameCount++;
      return;
    }
    
    // Успішно отримали кадр
    lastFrameTime = now;
    metrics.frameCount++;
    
    // Обчислюємо поточний FPS
    if (now - metrics.lastFpsTime >= 1000) {
      metrics.currentFps = Math.round((metrics.frameCount * 1000) / (now - metrics.lastFpsTime));
      metrics.frameCount = 0;
      metrics.lastFpsTime = now;
      
      // Оновлюємо інформацію про використання CPU
      metrics.cpuUsage = await getCPUUsage();
      metrics.memoryUsage = process.memoryUsage().heapUsed;
      
      // Відправка метрик на бекенд
      ws.send(JSON.stringify({
        type: 'metrics',
        fps: metrics.currentFps,
        skipFrames: metrics.skipFrameCount,
        cpu: metrics.cpuUsage,
        memory: metrics.memoryUsage,
        network: metrics.networkUsage.bytesPerSecond
      }));
      
      metrics.skipFrameCount = 0;
    }
    
    // Відправка кадру
    ws.send(frameData);
    
    // Моніторинг використання мережі
    monitorNetworkUsage(frameData.length);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logEvent(`Error capturing frame: ${errorMessage}`, 'error');
  }
}

/**
 * Зупинка захоплення екрану
 */
function stopCapture(): void {
  if (!isCapturing) {
    console.log('Screen capture is not running');
    return;
  }

  try {
    cleanupResources();
    console.log('Screen capture stopped successfully');
  } catch (error) {
    console.error('Failed to stop screen capture:', error);
  }
}

/**
 * Очищення ресурсів
 */
function cleanupResources(): void {
  isCapturing = false;
  if (captureInterval) {
    clearInterval(captureInterval);
    captureInterval = null;
  }
  
  if (screenCapture) {
    screenCapture.setActiveClients(false);
    screenCapture.release();
  }
  
  // Форсуємо звільнення пам'яті
  forceGarbageCollection();
  
  clients.clear();
}

// Обробники подій додатка Electron
app.on('ready', () => {
  // Завантаження конфігурації
  loadConfig();
  
  // Підключення до бекенду, коли додаток готовий
  connectToBackend();
});

app.on('window-all-closed', () => {
  stopCapture();
  cleanupResources();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    connectToBackend();
  }
});

app.on('quit', () => {
  cleanupResources();
  console.log('Application quit');
});

process.on('exit', () => {
  cleanupResources();
  console.log('Process exit');
});

// Обробка необроблених помилок
process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught exception:', error);
  logEvent(`Uncaught exception: ${error.message}`);
  // Спроба очистити ресурси перед аварійним завершенням
  cleanupResources();
});

process.on('unhandledRejection', (reason: any) => {
  console.error('Unhandled rejection:', reason);
  logEvent(`Unhandled rejection: ${reason}`);
});