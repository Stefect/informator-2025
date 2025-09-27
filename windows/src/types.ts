import * as WebSocket from 'ws';

/**
 * Конфігурація захоплення екрану
 */
export interface CaptureConfig {
  interval: number; // Інтервал між кадрами в мс
  quality: number;  // Якість JPEG (1-100)
  scale: number;    // Масштаб зображення (0.1-1.0)
  fps: number;      // Цільове FPS
}

/**
 * Інтерфейс для нативного модуля захоплення екрану
 */
export interface ScreenCaptureModule {
  // Основні методи захоплення
  capture: () => Buffer | null;
  captureScreen?: (quality: number, scale: number) => Buffer | null;
  getScreenSize: () => { width: number, height: number } | null;
  
  // Методи налаштування
  initialize?: () => boolean;
  init?: () => boolean;
  setQuality?: (quality: number) => void;
  setResolutionScale?: (scale: number) => void;
  setTargetFPS?: (fps: number) => void;
  setActiveClients?: (clients: number) => void;
  
  // Очищення ресурсів
  cleanup?: () => void;
}

/**
 * Типи клієнтів
 */
export enum ClientType {
  VIEWER = 'viewer',   // Глядач (отримує відеопотік)
  CAPTURER = 'capturer', // Клієнт захоплення (надсилає відеопотік)
  ADMIN = 'admin'     // Адміністратор (керує системою)
}

/**
 * Інформація про клієнта
 */
export interface ClientInfo {
  id: string;        // Унікальний ідентифікатор
  ip: string;        // IP-адреса
  type: ClientType;  // Тип клієнта
  connectedAt: Date; // Час підключення
  name?: string;     // Ім'я клієнта (опціонально)
  os?: string;       // Операційна система (опціонально)
  browser?: string;  // Браузер (опціонально)
}

/**
 * Інтерфейс клієнта
 */
export interface Client {
  ws: WebSocket;     // WebSocket з'єднання
  info: ClientInfo;  // Інформація про клієнта
}

/**
 * Метрики сервера
 */
export interface ServerMetrics {
  framesReceived: number; // Кількість отриманих кадрів
  framesSent: number;    // Кількість відправлених кадрів
  startTime: number;     // Час запуску сервера
  currentFPS: number;    // Поточний FPS
  lastFrameTime: number; // Час останнього кадру
  bytesReceived: number; // Кількість отриманих байтів
  bytesSent: number;     // Кількість відправлених байтів
}

/**
 * Типи повідомлень для потоку
 */
export type StreamMessageType = 'identify' | 'config' | 'viewerCount' | 'error' | 'status';

/**
 * Інтерфейс для повідомлень потоку
 */
export interface StreamMessage {
  type: StreamMessageType;   // Тип повідомлення
  data?: {                   // Дані повідомлення
    clientType?: ClientType;  // Тип клієнта (для identify)
    clientName?: string;      // Ім'я клієнта (для identify)
    captureConfig?: CaptureConfig; // Конфігурація захоплення (для config)
    viewerCount?: number;     // Кількість глядачів (для viewerCount)
    error?: string;           // Повідомлення про помилку (для error)
    [key: string]: any;      // Інші дані
  };
}
