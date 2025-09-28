import WebSocket from 'ws';
import { ClientMessage, ServerMessage, ClientConfig } from './types';

// Імпорт нативного модуля
const screenCapture = require('../gdi_screen_capture.node');

interface Config extends ClientConfig {
  serverUrl: string;
  reconnectInterval: number;
  heartbeatInterval: number;
}

class ScreenCaptureClient {
  private ws: WebSocket | null = null;
  private config: Config;
  private captureInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isCapturing = false;
  private clientId: string;

  constructor(config: Partial<Config> = {}) {
    this.config = {
      serverUrl: 'ws://localhost:8080',
      fps: 5,
      quality: 75,
      resolutionScale: 1.0,
      reconnectInterval: 5000,
      heartbeatInterval: 30000,
      ...config
    };
    
    this.clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Ініціалізувати нативний модуль
    this.initializeCapture();
  }

  private initializeCapture() {
    try {
      // Встановити параметри захоплення
      screenCapture.setTargetFPS(this.config.fps);
      screenCapture.setQuality(this.config.quality);
      screenCapture.setResolutionScale(this.config.resolutionScale);
      
      console.log(`[Client] Ініціалізовано захоплення екрану: FPS=${this.config.fps}, Quality=${this.config.quality}, Scale=${this.config.resolutionScale}`);
    } catch (error) {
      console.error('[Client] Помилка ініціалізації нативного модуля:', error);
      throw error;
    }
  }

  public async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log(`[Client] Підключення до ${this.config.serverUrl}...`);
        
        this.ws = new WebSocket(this.config.serverUrl);
        
        this.ws.on('open', () => {
          console.log('[Client] Підключено до сервера');
          
          // Відправити інформацію про клієнта
          this.sendMessage({
            type: 'client_info',
            clientId: this.clientId,
            screenSize: screenCapture.getScreenSize(),
            config: {
              fps: this.config.fps,
              quality: this.config.quality,
              resolutionScale: this.config.resolutionScale
            }
          });
          
          this.startHeartbeat();
          resolve();
        });
        
        this.ws.on('message', (data: Buffer) => {
          try {
            const message: ServerMessage = JSON.parse(data.toString());
            this.handleServerMessage(message);
          } catch (error) {
            console.error('[Client] Помилка парсингу повідомлення:', error);
          }
        });
        
        this.ws.on('close', (code, reason) => {
          console.log(`[Client] З'єднання закрито: ${code} - ${reason}`);
          this.cleanup();
          
          // Автоматичне перепідключення
          setTimeout(() => {
            console.log('[Client] Спроба перепідключення...');
            this.connect().catch(console.error);
          }, this.config.reconnectInterval);
        });
        
        this.ws.on('error', (error) => {
          console.error('[Client] Помилка WebSocket:', error);
          reject(error);
        });
        
      } catch (error) {
        reject(error);
      }
    });
  }

  private handleServerMessage(message: ServerMessage) {
    console.log(`[Client] Отримано повідомлення: ${message.type}`);
    
    switch (message.type) {
      case 'start_capture':
        this.startCapture();
        break;
        
      case 'stop_capture':
        this.stopCapture();
        break;
        
      case 'config_update':
        if (message.config) {
          this.updateConfig(message.config);
        }
        break;
        
      case 'ping':
        // Відповісти на пінг
        this.sendMessage({ type: 'pong' });
        break;
        
      default:
        console.warn('[Client] Невідоме повідомлення:', message);
    }
  }

  private startCapture() {
    if (this.isCapturing) {
      console.log('[Client] Захоплення вже активне');
      return;
    }
    
    console.log('[Client] Початок захоплення екрану');
    this.isCapturing = true;
    
    // Встановити статус активних клієнтів
    screenCapture.setActiveClients(true);
    
    // Почати захоплення з заданим FPS
    const frameInterval = 1000 / this.config.fps;
    this.captureInterval = setInterval(() => {
      this.captureAndSend();
    }, frameInterval);
  }

  private stopCapture() {
    if (!this.isCapturing) {
      return;
    }
    
    console.log('[Client] Зупинка захоплення екрану');
    this.isCapturing = false;
    
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }
    
    // Відключити активних клієнтів
    screenCapture.setActiveClients(false);
  }

  private async captureAndSend() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    
    try {
      // Захопити екран
      const frameBuffer = screenCapture.capture();
      
      if (!frameBuffer || frameBuffer.length === 0) {
        return;
      }
      
      // Створити повідомлення з кадром
      const frameMessage: ClientMessage = {
        type: 'frame_data',
        clientId: this.clientId,
        timestamp: Date.now(),
        data: frameBuffer.toString('base64'),
        metadata: {
          size: frameBuffer.length,
          format: 'jpeg'
        }
      };
      
      // Відправити кадр
      this.sendMessage(frameMessage);
      
    } catch (error) {
      console.error('[Client] Помилка захоплення кадру:', error);
    }
  }

  private updateConfig(newConfig: Partial<ClientConfig>) {
    console.log('[Client] Оновлення конфігурації:', newConfig);
    
    // Оновити локальну конфігурацію
    Object.assign(this.config, newConfig);
    
    // Застосувати зміни до нативного модуля
    if (newConfig.fps) {
      screenCapture.setTargetFPS(newConfig.fps);
    }
    if (newConfig.quality) {
      screenCapture.setQuality(newConfig.quality);
    }
    if (newConfig.resolutionScale) {
      screenCapture.setResolutionScale(newConfig.resolutionScale);
    }
    
    // Перезапустити захоплення з новими параметрами
    if (this.isCapturing) {
      this.stopCapture();
      this.startCapture();
    }
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendMessage({ type: 'ping' });
      }
    }, this.config.heartbeatInterval);
  }

  private sendMessage(message: ClientMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('[Client] Помилка відправки повідомлення:', error);
      }
    }
  }

  private cleanup() {
    this.stopCapture();
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    this.ws = null;
  }

  public disconnect() {
    console.log('[Client] Відключення...');
    this.cleanup();
    
    if (this.ws) {
      this.ws.close();
    }
  }

  public updateFPS(fps: number) {
    this.config.fps = fps;
    screenCapture.setTargetFPS(fps);
    
    if (this.isCapturing) {
      this.stopCapture();
      this.startCapture();
    }
    
    console.log(`[Client] FPS оновлено до ${fps}`);
  }

  public updateQuality(quality: number) {
    this.config.quality = quality;
    screenCapture.setQuality(quality);
    console.log(`[Client] Якість оновлено до ${quality}`);
  }

  public updateResolutionScale(scale: number) {
    this.config.resolutionScale = scale;
    screenCapture.setResolutionScale(scale);
    console.log(`[Client] Масштаб розділення оновлено до ${scale}`);
  }

  public getStatus() {
    return {
      connected: this.ws?.readyState === WebSocket.OPEN,
      capturing: this.isCapturing,
      clientId: this.clientId,
      config: this.config
    };
  }
}

// Запуск клієнта
async function main() {
  // Читання конфігурації з аргументів командного рядка або змінних середовища
  const serverUrl = process.env.SERVER_URL || 'ws://localhost:8080';
  const fps = parseInt(process.env.FPS || '5');
  const quality = parseInt(process.env.QUALITY || '75');
  const resolutionScale = parseFloat(process.env.RESOLUTION_SCALE || '1.0');
  
  const client = new ScreenCaptureClient({
    serverUrl,
    fps,
    quality,
    resolutionScale
  });
  
  // Обробка сигналів для коректного завершення
  process.on('SIGINT', () => {
    console.log('[Client] Отримано SIGINT, завершення роботи...');
    client.disconnect();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('[Client] Отримано SIGTERM, завершення роботи...');
    client.disconnect();
    process.exit(0);
  });
  
  try {
    await client.connect();
    console.log('[Client] Клієнт запущено і готовий до роботи');
    
    // Логувати статус кожні 10 секунд
    setInterval(() => {
      const status = client.getStatus();
      console.log(`[Client] Статус: Connected=${status.connected}, Capturing=${status.capturing}`);
    }, 10000);
    
  } catch (error) {
    console.error('[Client] Помилка запуску клієнта:', error);
    process.exit(1);
  }
}

// Запустити якщо цей файл викликано безпосередньо
if (require.main === module) {
  main().catch(console.error);
}

export { ScreenCaptureClient };
export default ScreenCaptureClient;