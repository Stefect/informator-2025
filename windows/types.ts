// Типи для WebSocket повідомлень
export type WSMessageType = 'control' | 'info' | 'metrics' | 'frame';
export type WSActionType = 'start' | 'stop';

export interface WSMessageBase {
  type: WSMessageType;
}

export interface WSControlMessage extends WSMessageBase {
  type: 'control';
  action: WSActionType;
}

export interface WSInfoMessage extends WSMessageBase {
  type: 'info';
  status: string;
}

export interface WSMetricsMessage extends WSMessageBase {
  type: 'metrics';
  metrics: {
    fps: number;
    cpuUsage: number;
    memoryUsage: number;
    networkUsage: number;
  };
}

export interface WSFrameMessage extends WSMessageBase {
  type: 'frame';
  data: string;
}

export type WSMessage = WSControlMessage | WSInfoMessage | WSMetricsMessage | WSFrameMessage;

// Типи для конфігурації
export interface ScreenCaptureConfig {
  port: number;
  jpegQuality: number;
  resolutionScale: number;
  targetFPS: number;
  changeThreshold: number;
  minFrameTime: number;
  maxFrameTime: number;
  adaptiveQuality: boolean;
  adaptiveFPS: boolean;
  maxMessageSize: number;
  networkThrottling: {
    enabled: boolean;
    maxBitrate: number;
  };
  memoryManagement: {
    maxBufferSize: number;
    gcInterval: number; // Інтервал запуску збирача сміття в мілісекундах
  };
  logging: {
    enabled: boolean;
    level: 'info' | 'warn' | 'error';
    file?: string;
  };
}

export interface PerformanceMetrics {
  lastFrameTime: number;
  frameCount: number;
  lastFpsTime: number;
  currentFps: number;
  skipFrameCount: number;
  cpuUsage: number;
  memoryUsage: number;
  networkUsage: {
    bytesSent: number;
    bytesPerSecond: number;
    lastUpdateTime: number;
  };
}

export interface ScreenCaptureNative {
  setTargetFPS(fps: number): boolean;
  setQuality(quality: number): boolean;
  setResolutionScale(scale: number): boolean;
  setChangeThreshold(threshold: number): boolean;
  getScreenSize(): { width: number; height: number } | null;
  capture(): Buffer | null;
  setActiveClients(active: boolean): void;
}

export interface CaptureOptions {
  targetFPS?: number;
  quality?: number;
  resolutionScale?: number;
  changeThreshold?: number;
}