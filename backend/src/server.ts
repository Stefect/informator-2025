import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import cors from 'cors';
import path from 'path';

// Rate limiting для запобігання перевантаженню
interface RateLimitInfo {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private limits = new Map<string, RateLimitInfo>();
  private maxRequests = 30; // 30 запитів на хвилину на IP
  private windowMs = 60000; // 1 хвилина

  public isAllowed(ip: string): boolean {
    const now = Date.now();
    const limit = this.limits.get(ip);

    if (!limit || now > limit.resetTime) {
      this.limits.set(ip, { count: 1, resetTime: now + this.windowMs });
      return true;
    }

    if (limit.count >= this.maxRequests) {
      return false;
    }

    limit.count++;
    return true;
  }

  public getRemainingRequests(ip: string): number {
    const limit = this.limits.get(ip);
    if (!limit) return this.maxRequests;
    return Math.max(0, this.maxRequests - limit.count);
  }
}

interface ClientConfig {
  fps: number;
  quality: number;
  resolutionScale: number;
}

interface ClientMessage {
  type: string;
  clientId?: string;
  timestamp?: number;
  data?: string;
  metadata?: any;
  screenSize?: any;
  config?: ClientConfig;
  message?: string;
}

interface ServerMessage {
  type: string;
  config?: Partial<ClientConfig>;
  clientCount?: number;
  message?: string;
}

interface ClientInfo {
  id: string;
  ws: WebSocket;
  connectedAt: Date;
  lastActivity: Date;
  isCapturing: boolean;
  screenSize?: { width: number; height: number };
  config: ClientConfig;
  ip: string;
}

interface ServerStats {
  uptime: number;
  totalClients: number;
  activeClients: number;
  capturingClients: number;
  totalFrames: number;
  totalBytes: number;
  averageFPS: number;
  memoryUsage: NodeJS.MemoryUsage;
}

interface AuthSession {
  token: string;
  createdAt: Date;
  lastActivity: Date;
}

class InformatorBackend {
  private app!: express.Application;
  private server: any;
  private wss!: WebSocketServer;
  private clients = new Map<string, ClientInfo>();
  private frames = new Map<string, Buffer>();
  private stats: ServerStats;
  private startTime: number;
  private rateLimiter = new RateLimiter(); // Додаємо rate limiter
  
  // Авторизація
  private readonly PASSWORD = 'informator2025'; // Простий пароль
  private authSessions = new Map<string, AuthSession>();

  constructor(private port: number = 8080) {
    this.startTime = Date.now();
    this.stats = {
      uptime: 0,
      totalClients: 0,
      activeClients: 0,
      capturingClients: 0,
      totalFrames: 0,
      totalBytes: 0,
      averageFPS: 0,
      memoryUsage: process.memoryUsage()
    };

    this.setupExpress();
    this.setupWebSocket();
    this.setupRoutes();
  }

  private setupExpress() {
    this.app = express();
    
    // CORS налаштування - дозволяємо доступ глобально
    this.app.use(cors({
      origin: [
        'http://localhost:3000',
        'http://localhost:8080', 
        'https://*.pages.dev', 
        'https://*.workers.dev',
        // Дозволяємо доступ з локальної мережі
        /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:8080$/,
        /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}:8080$/,
        /^http:\/\/172\.1[6-9]\.\d{1,3}\.\d{1,3}:8080$/,
        /^http:\/\/172\.2[0-9]\.\d{1,3}\.\d{1,3}:8080$/,
        /^http:\/\/172\.3[0-1]\.\d{1,3}\.\d{1,3}:8080$/,
        // Дозволяємо ngrok домени
        /^https:\/\/.*\.ngrok\.io$/,
        /^https:\/\/.*\.ngrok-free\.app$/,
        // Дозволяємо Cloudflare Tunnel
        /^https:\/\/.*\.trycloudflare\.com$/,
        // Дозволяємо будь-які HTTPS домени (для тестування)
        /^https:\/\/.*$/
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-auth-token']
    }));

    this.app.use(express.json({ limit: '50mb' }));
    
    // Rate limiting middleware
    this.app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      const clientIP = req.ip || req.socket.remoteAddress || 'unknown';
      
      // Пропускаємо rate limiting для локальних запитів
      if (clientIP === '127.0.0.1' || clientIP === '::1' || clientIP.startsWith('192.168.')) {
        return next();
      }
      
      if (!this.rateLimiter.isAllowed(clientIP)) {
        const remaining = this.rateLimiter.getRemainingRequests(clientIP);
        res.set({
          'X-RateLimit-Limit': '30',
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': (Date.now() + 60000).toString()
        });
        return res.status(429).json({ 
          error: 'Too Many Requests', 
          message: 'Rate limit exceeded. Please wait before making more requests.',
          retryAfter: 60
        });
      }
      
      next();
    });
    
    this.app.use(express.static(path.join(__dirname, '../../frontend')));

    // Створюємо HTTP сервер
    this.server = createServer(this.app);
  }

  // Генерація випадкового токену
  private generateToken(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  // Перевірка авторизації
  private isAuthenticated(req: express.Request): boolean {
    const token = req.headers.authorization?.replace('Bearer ', '') || 
                  req.headers['x-auth-token'] as string ||
                  req.query.token as string;
    
    console.log(`[Auth Check] URL: ${req.url}, Authorization header: ${req.headers.authorization || 'відсутній'}`);
    console.log(`[Auth Check] Extracted token: ${token ? token.substring(0, 10) + '...' : 'відсутній'}`);
    
    if (!token) {
      console.log('[Auth Check] Немає токена, доступ заборонено');
      return false;
    }
    
    const session = this.authSessions.get(token);
    if (!session) {
      console.log('[Auth Check] Сесія не знайдена для токена');
      return false;
    }
    
    // Токен дійсний 24 години
    const isExpired = (Date.now() - session.createdAt.getTime()) > 24 * 60 * 60 * 1000;
    if (isExpired) {
      console.log('[Auth Check] Токен прострочений');
      this.authSessions.delete(token);
      return false;
    }
    
    // Оновлюємо активність
    session.lastActivity = new Date();
    console.log('[Auth Check] Аутентифікація успішна');
    return true;
  }

  // Middleware для захищених маршрутів
  private requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (this.isAuthenticated(req)) {
      next();
    } else {
      res.status(401).json({ error: 'Unauthorized' });
    }
  };

  private setupWebSocket() {
    this.wss = new WebSocketServer({ 
      server: this.server,
      perMessageDeflate: {
        zlibDeflateOptions: {
          chunkSize: 1024,
          windowBits: 13,
          level: 3,
        },
        threshold: 1024,
        concurrencyLimit: 10,
        clientMaxWindowBits: 13,
        serverMaxWindowBits: 13,
        serverNoContextTakeover: false,
        clientNoContextTakeover: false
      }
    });

    this.wss.on('connection', (ws: WebSocket, req: any) => {
      this.handleNewConnection(ws, req);
    });

    console.log('[Backend] WebSocket сервер налаштовано');
  }

  private handleNewConnection(ws: WebSocket, req: any) {
    const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const clientIp = req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    
    console.log(`[Backend] Новий клієнт підключився: ${clientId} з IP ${clientIp}`);
    
    const clientInfo: ClientInfo = {
      id: clientId,
      ws: ws,
      connectedAt: new Date(),
      lastActivity: new Date(),
      isCapturing: false,
      config: {
        fps: 20,
        quality: 75,
        resolutionScale: 1.0
      },
      ip: clientIp
    };

    this.clients.set(clientId, clientInfo);
    this.stats.totalClients++;
    this.updateActiveClients();

    // Обробка повідомлень від клієнта
    ws.on('message', (data: Buffer) => {
      try {
        const message: ClientMessage = JSON.parse(data.toString());
        this.handleClientMessage(clientId, message);
      } catch (error) {
        console.error(`[Backend] Помилка парсингу повідомлення від ${clientId}:`, error);
        this.sendToClient(clientId, {
          type: 'error',
          message: 'Неможливо розпарсити повідомлення'
        });
      }
    });

    // Обробка відключення клієнта
    ws.on('close', () => {
      console.log(`[Backend] Клієнт ${clientId} відключився`);
      this.handleClientDisconnect(clientId);
    });

    // Обробка помилок WebSocket
    ws.on('error', (error: Error) => {
      console.error(`[Backend] Помилка WebSocket для ${clientId}:`, error.message);
      // Не викликаємо handleClientDisconnect тут, щоб уникнути подвійного видалення
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      } catch (e) {
        // Ігноруємо помилки при закритті
      }
    });

    // Ping для підтримки з'єднання
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          this.sendToClient(clientId, { type: 'ping' });
        } catch (error) {
          console.error(`[Backend] Помилка ping для ${clientId}:`, error);
          clearInterval(pingInterval);
          this.handleClientDisconnect(clientId);
        }
      } else {
        clearInterval(pingInterval);
      }
    }, 30000); // Ping кожні 30 секунд

    // Надіслати привітання клієнту
    try {
      this.sendToClient(clientId, {
        type: 'connection_established',
        message: 'Підключення успішне'
      });
    } catch (error) {
      console.error(`[Backend] Не вдалося відправити привітання ${clientId}:`, error);
    }
  }

  private handleClientMessage(clientId: string, message: ClientMessage) {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    client.lastActivity = new Date();

    console.log(`[Backend] Повідомлення від ${clientId}: ${message.type}`);

    switch (message.type) {
      case 'client_info':
        this.handleClientInfo(clientId, message);
        break;

      case 'frame_data':
        this.handleFrameData(clientId, message);
        break;

      case 'ping':
        this.sendToClient(clientId, { type: 'pong' });
        break;

      case 'status_update':
        console.log(`[Backend] Статус від ${clientId}:`, message.message);
        break;

      default:
        console.warn(`[Backend] Невідомий тип повідомлення від ${clientId}:`, message.type);
    }
  }

  private handleClientInfo(clientId: string, message: ClientMessage) {
    const client = this.clients.get(clientId);
    if (!client) return;

    if (message.screenSize) {
      client.screenSize = message.screenSize;
    }
    if (message.config) {
      client.config = { ...client.config, ...message.config };
    }

    console.log(`[Backend] Інформація про клієнта ${clientId}:`, {
      screenSize: client.screenSize,
      config: client.config
    });

    // Відправити команду початку захоплення
    this.sendToClient(clientId, { type: 'start_capture' });
  }

  private handleFrameData(clientId: string, message: ClientMessage) {
    const client = this.clients.get(clientId);
    if (!client || !message.data) {
      return;
    }

    try {
      // Декодувати Base64 дані
      const frameBuffer = Buffer.from(message.data, 'base64');
      
      // Зберегти кадр
      this.frames.set(clientId, frameBuffer);
      
      // Оновити статистику
      this.stats.totalFrames++;
      this.stats.totalBytes += frameBuffer.length;
      client.isCapturing = true;
      
      // Відправити кадр всім глядачам (якщо є)
      this.broadcastFrame(clientId, frameBuffer);
      
      console.log(`[Backend] Отримано кадр від ${clientId}: ${frameBuffer.length} байт`);

    } catch (error) {
      console.error(`[Backend] Помилка обробки кадру від ${clientId}:`, error);
      this.sendToClient(clientId, {
        type: 'error',
        message: 'Помилка обробки кадру'
      });
    }
  }

  private broadcastFrame(senderId: string, frameBuffer: Buffer) {
    // В майбутньому тут буде логіка відправки кадрів глядачам
    // Поки що просто логуємо
    console.log(`[Backend] Трансляція кадру від ${senderId} (${frameBuffer.length} байт)`);
  }

  private handleClientDisconnect(clientId: string) {
    const client = this.clients.get(clientId);
    if (!client) return;

    console.log(`[Backend] Клієнт ${clientId} відключився`);
    
    this.clients.delete(clientId);
    this.frames.delete(clientId);
    this.updateActiveClients();
  }

  private updateActiveClients() {
    this.stats.activeClients = this.clients.size;
    this.stats.capturingClients = Array.from(this.clients.values())
      .filter(client => client.isCapturing).length;
  }

  private sendToClient(clientId: string, message: ServerMessage) {
    const client = this.clients.get(clientId);
    if (!client) {
      console.warn(`[Backend] Клієнт ${clientId} не знайдений для відправки повідомлення`);
      return;
    }

    if (client.ws.readyState !== WebSocket.OPEN) {
      console.warn(`[Backend] WebSocket для ${clientId} не відкритий (стан: ${client.ws.readyState})`);
      // Автоматично видаляємо клієнта з неактивним з'єднанням
      if (client.ws.readyState === WebSocket.CLOSED || client.ws.readyState === WebSocket.CLOSING) {
        this.handleClientDisconnect(clientId);
      }
      return;
    }

    try {
      const messageStr = JSON.stringify(message);
      client.ws.send(messageStr);
      client.lastActivity = new Date(); // Оновлюємо час останньої активності
    } catch (error) {
      console.error(`[Backend] Помилка відправки повідомлення до ${clientId}:`, error);
      // Не викликаємо handleClientDisconnect тут, щоб уникнути рекурсії
      try {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.close();
        }
      } catch (closeError) {
        // Ігноруємо помилки закриття
      }
    }
  }

  private broadcastMessage(message: ServerMessage) {
    this.clients.forEach((client, clientId) => {
      this.sendToClient(clientId, message);
    });
  }

  private setupRoutes() {
    // Статичні файли з папки frontend
    this.app.use(express.static(path.join(__dirname, '../../frontend')));
    
    // Маршрут для авторизації
    this.app.post('/api/login', (req, res) => {
      const { password } = req.body;
      
      if (password === this.PASSWORD) {
        const token = this.generateToken();
        const session: AuthSession = {
          token,
          createdAt: new Date(),
          lastActivity: new Date()
        };
        
        this.authSessions.set(token, session);
        
        console.log(`[Auth] Успішна авторизація, токен: ${token}`);
        res.json({ success: true, token });
      } else {
        console.log(`[Auth] Невдала спроба авторизації з паролем: ${password}`);
        res.status(401).json({ success: false, error: 'Невірний пароль' });
      }
    });

    // Головна сторінка - перевіряємо авторизацію
    this.app.get('/', (req, res) => {
      if (this.isAuthenticated(req)) {
        res.sendFile(path.join(__dirname, '../../frontend/index.html'));
      } else {
        res.sendFile(path.join(__dirname, '../../frontend/login.html'));
      }
    });

    // Додаткова сторінка для діагностики (доступна на /status)
    this.app.get('/status', (req, res) => {
      res.send(`
        <html>
          <head>
            <title>Informator Backend Status</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 40px; }
              .stats { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .client { background: white; padding: 15px; margin: 10px 0; border-left: 4px solid #007cba; }
            </style>
          </head>
          <body>
            <h1>Informator Backend Server Status</h1>
            <p>Сервер працює на порту ${this.port}</p>
            <div class="stats">
              <h3>Статистика</h3>
              <p>Час роботи: ${Math.floor((Date.now() - this.startTime) / 1000)} секунд</p>
              <p>Активних клієнтів: ${this.stats.activeClients}</p>
              <p>Клієнтів захоплення: ${this.stats.capturingClients}</p>
              <p>Загальна кількість кадрів: ${this.stats.totalFrames}</p>
            </div>
            <div id="clients"></div>
            <script>
              // Оновлювати статистику кожні 5 секунд
              setInterval(() => {
                fetch('/api/stats').then(r => r.json()).then(stats => {
                  document.querySelector('.stats').innerHTML = 
                    '<h3>Статистика</h3>' +
                    '<p>Час роботи: ' + Math.floor(stats.uptime / 1000) + ' секунд</p>' +
                    '<p>Активних клієнтів: ' + stats.activeClients + '</p>' +
                    '<p>Клієнтів захоплення: ' + stats.capturingClients + '</p>' +
                    '<p>Загальна кількість кадрів: ' + stats.totalFrames + '</p>';
                });
              }, 5000);
            </script>
          </body>
        </html>
      `);
    });

    // API для статистики (захищено)
    this.app.get('/api/stats', this.requireAuth, (req, res) => {
      this.stats.uptime = Date.now() - this.startTime;
      this.stats.memoryUsage = process.memoryUsage();
      res.json(this.stats);
    });

    // API для списку клієнтів
    this.app.get('/api/clients', this.requireAuth, (req, res) => {
      const clientList = Array.from(this.clients.values()).map(client => ({
        id: client.id,
        connectedAt: client.connectedAt,
        lastActivity: client.lastActivity,
        isCapturing: client.isCapturing,
        screenSize: client.screenSize,
        config: client.config,
        ip: client.ip
      }));
      res.json(clientList);
    });

    // API для отримання останнього кадру від клієнта
    this.app.get('/api/frame/:clientId', this.requireAuth, (req, res) => {
      const clientId = req.params.clientId;
      const frame = this.frames.get(clientId);
      
      if (!frame) {
        return res.status(404).json({ error: 'Кадр не знайдено' });
      }

      res.set('Content-Type', 'image/jpeg');
      res.send(frame);
    });

    // HTTP Streams для Cloudflare сумісності
    this.app.get('/api/stream/:clientId', this.requireAuth, (req, res) => {
      const clientId = req.params.clientId;
      
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      // Відправити початкове повідомлення
      res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);

      const intervalId = setInterval(() => {
        const frame = this.frames.get(clientId);
        if (frame) {
          const eventData = {
            type: 'frame',
            clientId,
            timestamp: Date.now(),
            data: frame.toString('base64')
          };
          res.write(`data: ${JSON.stringify(eventData)}\n\n`);
        }
      }, 50); // 20 FPS (1000ms / 20 = 50ms)

      req.on('close', () => {
        clearInterval(intervalId);
        console.log(`[Backend] HTTP Stream клієнт відключився від ${clientId}`);
      });
    });

    // API для отримання інформації про мережу
    this.app.get('/api/network-info', this.requireAuth, (req, res) => {
      try {
        const os = require('os');
        const networkInterfaces = os.networkInterfaces();
        let localIP = 'localhost';

        // Знайти локальний IP
        for (const interfaceName of Object.keys(networkInterfaces)) {
          const networkInterface = networkInterfaces[interfaceName];
          for (const alias of networkInterface) {
            if (alias.family === 'IPv4' && !alias.internal) {
              localIP = alias.address;
              break;
            }
          }
          if (localIP !== 'localhost') break;
        }

        res.json({ localIP });
      } catch (error) {
        res.status(500).json({ error: 'Помилка отримання мережевої інформації' });
      }
    });

    // API для перевірки статусу ngrok
    this.app.get('/api/ngrok-status', this.requireAuth, (req, res) => {
      // Тут буде логіка перевірки ngrok через API або файл
      res.json({ status: 'inactive', url: null });
    });

    // API для активації ngrok
    this.app.post('/api/activate-ngrok', this.requireAuth, (req, res) => {
      try {
        // Запуск ngrok через Windows batch script
        const spawn = require('child_process').spawn;
        const ngrokProcess = spawn('cmd', ['/c', 'start-ngrok.bat'], {
          cwd: process.cwd().replace('backend', ''),
          detached: true,
          stdio: 'ignore'
        });

        ngrokProcess.unref();
        
        res.json({ 
          success: true, 
          message: 'Ngrok активується...', 
          url: 'Активується...' 
        });
      } catch (error) {
        console.error('Помилка запуску ngrok:', error);
        res.status(500).json({ 
          success: false, 
          error: 'Помилка запуску ngrok' 
        });
      }
    });

    console.log('[Backend] HTTP маршрути налаштовано');
  }

  public start() {
    this.server.listen(this.port, '0.0.0.0', () => {
      console.log(`[Backend] Informator Backend запущено на порту ${this.port}`);
      console.log(`[Backend] WebSocket: ws://localhost:${this.port}`);
      console.log(`[Backend] HTTP API: http://localhost:${this.port}/api`);
      console.log(`[Backend] Frontend: http://localhost:${this.port}`);
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log('[Backend] Отримано SIGINT, завершення роботи...');
      this.server.close(() => {
        console.log('[Backend] Сервер зупинено');
        process.exit(0);
      });
    });

    process.on('SIGTERM', () => {
      console.log('[Backend] Отримано SIGTERM, завершення роботи...');
      this.server.close(() => {
        console.log('[Backend] Сервер зупинено');
        process.exit(0);
      });
    });
  }
}

// Запуск сервера
const port = parseInt(process.env.PORT || '8080');
const backend = new InformatorBackend(port);
backend.start();