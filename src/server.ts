import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import path from 'path';
import * as winston from 'winston';
import * as fs from 'fs';

// Налаштування логування
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'informator-server' },
    transports: [
        new winston.transports.File({ filename: './logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: './logs/combined.log' }),
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

// Створюємо папку для логів
if (!fs.existsSync('./logs')) {
    fs.mkdirSync('./logs', { recursive: true });
}

interface UserInfo {
    firstName: string;
    lastName: string;
    fullName: string;
    quality: string;
    frameRate: number;
}

interface ClientConnection {
    id: string;
    ws: WebSocket;
    type: 'viewer' | 'capture_client';
    connectedAt: Date;
    lastActivity: Date;
    userInfo?: UserInfo; // Додаємо інформацію про користувача
    metrics: {
        framesReceived: number;
        framesSent: number;
        bytesReceived: number;
        bytesSent: number;
    };
}

interface CaptureSession {
    isActive: boolean;
    captureClient: ClientConnection | null;
    viewers: Set<string>;
    startedAt: Date | null;
    config: {
        fps: number;
        quality: number;
        autoStart: boolean;
    };
}

class InformatorServer {
    private app = express();
    private server = createServer(this.app);
    private wss = new WebSocketServer({ server: this.server });
    private clients = new Map<string, ClientConnection>();
    private captureSession: CaptureSession;
    private heartbeatInterval?: NodeJS.Timeout;
    private metricsInterval?: NodeJS.Timeout;
    private startTime = Date.now();

    constructor(private port: number = 3001) {
        this.captureSession = {
            isActive: false,
            captureClient: null,
            viewers: new Set(),
            startedAt: null,
            config: {
                fps: 30, // Мінімум 30 FPS згідно вимог конкурсу
                quality: 75, // Знижуємо якість для кращої продуктивності
                autoStart: true
            }
        };

        this.setupExpress();
        this.setupWebSocket();
        this.setupHeartbeat();
        this.setupMetricsLogging();
        this.setupGracefulShutdown();
    }

    private setupExpress(): void {
        // CORS headers для remote access
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
            
            if (req.method === 'OPTIONS') {
                res.sendStatus(200);
            } else {
                next();
            }
        });

        // Статичні файли
        this.app.use(express.static(path.join(__dirname, '..')));
        this.app.use(express.json());

        // API endpoints
        this.app.get('/api/status', (req, res) => {
            res.json({
                server: {
                    uptime: Date.now() - this.startTime,
                    connections: this.clients.size,
                    version: '2.0.0'
                },
                capture: {
                    isActive: this.captureSession.isActive,
                    viewers: this.captureSession.viewers.size,
                    hasClient: !!this.captureSession.captureClient,
                    config: this.captureSession.config
                }
            });
        });

        this.app.post('/api/capture/config', (req, res) => {
            const { fps, quality, autoStart } = req.body;
            
            if (fps) this.captureSession.config.fps = Math.max(1, Math.min(60, fps));
            if (quality) this.captureSession.config.quality = Math.max(1, Math.min(100, quality));
            if (typeof autoStart === 'boolean') this.captureSession.config.autoStart = autoStart;

            // Повідомляємо capture client про зміни
            if (this.captureSession.captureClient) {
                this.sendToClient(this.captureSession.captureClient.id, {
                    type: 'config_update',
                    config: this.captureSession.config
                });
            }

            logger.info('Capture config updated', this.captureSession.config);
            res.json({ success: true, config: this.captureSession.config });
        });

        // Головна сторінка
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '..', 'index.html'));
        });
    }

    private setupWebSocket(): void {
        this.wss.on('connection', (ws, req) => {
            const clientId = this.generateClientId();
            const clientIP = req.socket.remoteAddress || 'unknown';
            
            const client: ClientConnection = {
                id: clientId,
                ws,
                type: 'viewer', // За замовчуванням viewer
                connectedAt: new Date(),
                lastActivity: new Date(),
                metrics: {
                    framesReceived: 0,
                    framesSent: 0,
                    bytesReceived: 0,
                    bytesSent: 0
                }
            };

            this.clients.set(clientId, client);
            logger.info(`New connection: ${clientId} from ${clientIP}`);

            // Відправляємо привітання
            this.sendToClient(clientId, {
                type: 'connected',
                clientId,
                message: 'Підключено до Informator Server',
                timestamp: new Date().toISOString(),
                serverInfo: {
                    version: '2.0.0',
                    capabilities: ['screen_capture', 'recording', 'multi_viewer']
                }
            });

            // Обробка повідомлень
            ws.on('message', (data) => {
                this.handleClientMessage(clientId, data);
            });

            // Обробка відключення
            ws.on('close', () => {
                this.handleClientDisconnect(clientId);
            });

            // Обробка помилок
            ws.on('error', (error) => {
                logger.error(`WebSocket error for client ${clientId}:`, error);
                this.handleClientDisconnect(clientId);
            });

            logger.info(`Total connections: ${this.clients.size}`);
        });
    }

    private handleClientMessage(clientId: string, data: any): void {
        const client = this.clients.get(clientId);
        if (!client) return;

        client.lastActivity = new Date();

        try {
            // Спробуємо парсити як JSON
            const message = JSON.parse(data.toString());
            logger.debug(`Message from ${clientId}:`, message.type);

            switch (message.type) {
                case 'ping':
                    this.sendToClient(clientId, { 
                        type: 'pong', 
                        timestamp: new Date().toISOString() 
                    });
                    break;

                case 'client_ready':
                    this.handleClientReady(clientId, message);
                    break;

                case 'viewer_join':
                    this.handleViewerJoin(clientId, message.user);
                    break;

                case 'update_preferences':
                    this.handleUpdatePreferences(clientId, message.preferences);
                    break;

                case 'chat_message':
                    this.handleChatMessage(clientId, message);
                    break;

                case 'request_capture_start':
                    this.handleCaptureStartRequest(clientId);
                    break;

                case 'request_capture_stop':
                    this.handleCaptureStopRequest(clientId);
                    break;

                default:
                    logger.warn(`Unknown message type: ${message.type} from ${clientId}`);
            }

        } catch (error) {
            // Це бінарні дані (кадр)
            this.handleFrameData(clientId, data);
        }
    }

    private handleClientReady(clientId: string, message: any): void {
        const client = this.clients.get(clientId);
        if (!client) return;

        // Це capture client
        client.type = 'capture_client';
        
        if (this.captureSession.captureClient) {
            // Вже є capture client
            this.sendToClient(clientId, {
                type: 'error',
                message: 'Capture client already connected'
            });
            return;
        }

        this.captureSession.captureClient = client;
        logger.info(`Capture client ready: ${clientId}`, message.capabilities);

        // Автоматичний старт якщо є viewers
        if (this.captureSession.config.autoStart && this.captureSession.viewers.size > 0) {
            this.startCapture();
        }
    }

    private handleViewerJoin(clientId: string, userInfo?: UserInfo): void {
        const client = this.clients.get(clientId);
        if (!client) return;

        client.type = 'viewer';
        
        // Зберігаємо інформацію про користувача
        if (userInfo) {
            client.userInfo = userInfo;
            logger.info(`Viewer joined: ${clientId} - ${userInfo.fullName} (${userInfo.quality}, ${userInfo.frameRate} FPS). Total viewers: ${this.captureSession.viewers.size + 1}`);
        } else {
            logger.info(`Viewer joined: ${clientId}. Total viewers: ${this.captureSession.viewers.size + 1}`);
        }

        this.captureSession.viewers.add(clientId);

        // Автоматичний старт захоплення
        if (this.captureSession.config.autoStart && 
            this.captureSession.captureClient && 
            !this.captureSession.isActive) {
            this.startCapture();
        }

        // Повідомляємо viewer про стан
        this.sendToClient(clientId, {
            type: 'capture_status',
            isActive: this.captureSession.isActive,
            viewerCount: this.captureSession.viewers.size
        });

        // Повідомляємо всіх viewers про нову кількість
        this.broadcastViewerCount();

        // Повідомляємо всіх про нового користувача
        if (userInfo) {
            this.broadcastToViewers({
                type: 'user_joined',
                username: userInfo.fullName
            });
        }

        // Логуємо поточних viewers
        this.logActiveViewers();
    }

    private broadcastViewerCount(): void {
        const count = this.captureSession.viewers.size;
        this.captureSession.viewers.forEach(viewerId => {
            this.sendToClient(viewerId, {
                type: 'viewer_update',
                count: count
            });
        });
    }

    private broadcastToViewers(message: any): void {
        this.captureSession.viewers.forEach(viewerId => {
            this.sendToClient(viewerId, message);
        });
    }

    private handleUpdatePreferences(clientId: string, preferences: any): void {
        const client = this.clients.get(clientId);
        if (!client) return;

        // Оновлюємо інформацію про користувача
        if (preferences) {
            client.userInfo = {
                firstName: preferences.firstName,
                lastName: preferences.lastName,
                fullName: `${preferences.firstName} ${preferences.lastName}`,
                quality: preferences.quality,
                frameRate: preferences.frameRate
            };
            
            logger.info(`User preferences updated: ${clientId} - ${client.userInfo.fullName} (${client.userInfo.quality}, ${client.userInfo.frameRate} FPS)`);
            
            // Підтверджуємо оновлення
            this.sendToClient(clientId, {
                type: 'preferences_updated',
                success: true
            });
        }
    }

    private handleChatMessage(clientId: string, message: any): void {
        const client = this.clients.get(clientId);
        if (!client) return;

        const chatMessage = {
            type: 'chat_message',
            username: message.user?.fullName || 'Anonymous',
            message: message.message,
            timestamp: new Date().toISOString(),
            clientId: clientId
        };

        logger.info(`Chat message from ${chatMessage.username}: ${message.message}`);

        // Broadcast to all viewers (except sender)
        this.captureSession.viewers.forEach(viewerId => {
            if (viewerId !== clientId) {
                this.sendToClient(viewerId, chatMessage);
            }
        });
    }

    private logActiveViewers(): void {
        const viewers: string[] = [];
        this.captureSession.viewers.forEach(viewerId => {
            const client = this.clients.get(viewerId);
            if (client && client.userInfo) {
                viewers.push(`${client.userInfo.fullName} (${client.userInfo.quality})`);
            } else {
                viewers.push(`Anonymous-${viewerId.substring(0, 8)}`);
            }
        });
        
        if (viewers.length > 0) {
            logger.info(`Active viewers (${viewers.length}): ${viewers.join(', ')}`);
        }
    }

    private handleCaptureStartRequest(clientId: string): void {
        if (this.captureSession.captureClient) {
            this.startCapture();
        } else {
            this.sendToClient(clientId, {
                type: 'error',
                message: 'No capture client connected'
            });
        }
    }

    private handleCaptureStopRequest(clientId: string): void {
        this.stopCapture();
    }

    private handleFrameData(clientId: string, data: Buffer): void {
        const client = this.clients.get(clientId);
        if (!client) return;

        // Дозволяємо відправку кадрів від capture_client або viewer (для тестування)
        if (client.type !== 'capture_client' && client.type !== 'viewer') return;

        client.metrics.framesReceived++;
        client.metrics.bytesReceived += data.length;

        // Розсилаємо кадр всім viewers (окрім відправника)
        this.broadcastFrame(data, clientId);

        logger.info(`Frame received from ${client.type} ${clientId}: ${data.length} bytes, broadcasting to ${this.captureSession.viewers.size} viewers`);
    }

    private broadcastFrame(data: Buffer, excludeClientId?: string): void {
        const frameSize = data.length;
        let successfulSends = 0;

        this.captureSession.viewers.forEach(viewerId => {
            if (viewerId === excludeClientId) return;

            const client = this.clients.get(viewerId);
            if (!client || client.ws.readyState !== WebSocket.OPEN) {
                this.captureSession.viewers.delete(viewerId);
                return;
            }

            try {
                client.ws.send(data);
                client.metrics.framesSent++;
                client.metrics.bytesSent += frameSize;
                successfulSends++;
            } catch (error) {
                logger.error(`Failed to send frame to viewer ${viewerId}:`, error);
                this.captureSession.viewers.delete(viewerId);
            }
        });

        logger.debug(`Frame broadcasted to ${successfulSends}/${this.captureSession.viewers.size} viewers`);
    }

    private startCapture(): void {
        if (!this.captureSession.captureClient || this.captureSession.isActive) return;

        this.captureSession.isActive = true;
        this.captureSession.startedAt = new Date();

        this.sendToClient(this.captureSession.captureClient.id, {
            type: 'start_capture',
            config: this.captureSession.config
        });

        // Повідомляємо всім viewers
        this.captureSession.viewers.forEach(viewerId => {
            this.sendToClient(viewerId, {
                type: 'capture_started',
                timestamp: new Date().toISOString()
            });
        });

        logger.info('Screen capture started', {
            viewers: this.captureSession.viewers.size,
            config: this.captureSession.config
        });
    }

    private stopCapture(): void {
        if (!this.captureSession.isActive) return;

        this.captureSession.isActive = false;

        if (this.captureSession.captureClient) {
            this.sendToClient(this.captureSession.captureClient.id, {
                type: 'stop_capture'
            });
        }

        // Повідомляємо всім viewers
        this.captureSession.viewers.forEach(viewerId => {
            this.sendToClient(viewerId, {
                type: 'capture_stopped',
                timestamp: new Date().toISOString()
            });
        });

        logger.info('Screen capture stopped');
    }

    private handleClientDisconnect(clientId: string): void {
        const client = this.clients.get(clientId);
        if (!client) return;

        logger.info(`Client disconnected: ${clientId} (${client.type})`);

        if (client.type === 'capture_client') {
            this.captureSession.captureClient = null;
            this.captureSession.isActive = false;
            
            // Повідомляємо viewers про втрату capture client
            this.captureSession.viewers.forEach(viewerId => {
                this.sendToClient(viewerId, {
                    type: 'capture_client_disconnected',
                    message: 'Screen capture client disconnected'
                });
            });
            
            logger.warn('Capture client disconnected - stopping capture');
        } else if (client.type === 'viewer') {
            this.captureSession.viewers.delete(clientId);
            
            // Повідомляємо інших про відключення
            if (client.userInfo) {
                this.broadcastToViewers({
                    type: 'user_left',
                    username: client.userInfo.fullName
                });
            }
            
            // Оновлюємо viewer count для всіх
            this.broadcastViewerCount();
            
            // Зупиняємо захоплення якщо немає viewers
            if (this.captureSession.viewers.size === 0 && this.captureSession.isActive) {
                this.stopCapture();
                logger.info('No viewers left - stopping capture to save resources');
            }
        }

        this.clients.delete(clientId);
        logger.info(`Total connections: ${this.clients.size}`);
    }

    private sendToClient(clientId: string, message: any): void {
        const client = this.clients.get(clientId);
        if (!client || client.ws.readyState !== WebSocket.OPEN) return;

        try {
            client.ws.send(JSON.stringify(message));
        } catch (error) {
            logger.error(`Failed to send message to client ${clientId}:`, error);
        }
    }

    private generateClientId(): string {
        return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private setupHeartbeat(): void {
        this.heartbeatInterval = setInterval(() => {
            const now = new Date();
            const timeout = 60000; // 60 секунд

            this.clients.forEach((client, clientId) => {
                const timeSinceActivity = now.getTime() - client.lastActivity.getTime();
                
                if (timeSinceActivity > timeout) {
                    logger.warn(`Client ${clientId} timeout - disconnecting`);
                    client.ws.terminate();
                    this.handleClientDisconnect(clientId);
                } else {
                    // Відправляємо ping
                    this.sendToClient(clientId, { type: 'ping' });
                }
            });
        }, 30000); // Кожні 30 секунд
    }

    private setupMetricsLogging(): void {
        this.metricsInterval = setInterval(() => {
            const uptime = Date.now() - this.startTime;
            const totalFrames = Array.from(this.clients.values())
                .reduce((sum, client) => sum + client.metrics.framesReceived, 0);

            logger.info('Server metrics', {
                uptime: Math.round(uptime / 1000),
                connections: this.clients.size,
                viewers: this.captureSession.viewers.size,
                captureActive: this.captureSession.isActive,
                totalFrames,
                memoryUsage: process.memoryUsage()
            });
        }, 60000); // Кожну хвилину
    }

    private setupGracefulShutdown(): void {
        const shutdown = () => {
            logger.info('Server shutting down...');
            
            // Зупиняємо захоплення
            this.stopCapture();
            
            // Закриваємо всі підключення
            this.clients.forEach((client, clientId) => {
                this.sendToClient(clientId, {
                    type: 'server_shutdown',
                    message: 'Server is shutting down'
                });
                client.ws.close(1000, 'Server shutdown');
            });
            
            // Очищаємо інтервали
            if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
            if (this.metricsInterval) clearInterval(this.metricsInterval);
            
            // Закриваємо сервер
            this.server.close(() => {
                logger.info('Server shutdown complete');
                process.exit(0);
            });
        };

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
    }

    public start(): void {
        const host = process.env.HOST || '0.0.0.0'; // Слухаємо на всіх інтерфейсах
        
        this.server.listen(this.port, host, () => {
            // Отримуємо локальну IP адресу
            const networkInterfaces = require('os').networkInterfaces();
            const localIPs: string[] = [];
            
            Object.keys(networkInterfaces).forEach(interfaceName => {
                const interfaces = networkInterfaces[interfaceName];
                interfaces?.forEach((networkInterface: any) => {
                    if (networkInterface.family === 'IPv4' && !networkInterface.internal) {
                        localIPs.push(networkInterface.address);
                    }
                });
            });

            const primaryIP = localIPs[0] || 'localhost';
            
            logger.info(`
╔══════════════════════════════════════╗
║      🖥️  INFORMATOR SERVER v2.0      ║
║                                      ║
║  🌐 Local: http://localhost:${this.port}       ║
║  🌍 Remote: http://${primaryIP}:${this.port}     ║
║  🔌 WebSocket: ws://${primaryIP}:${this.port}    ║
║  📊 API: http://${primaryIP}:${this.port}/api    ║
║                                      ║
║  📊 Status: READY                    ║
║  🎯 Mode: Smart Capture Management   ║
║  ⚡ Remote Access Enabled            ║
╚══════════════════════════════════════╝

🔗 Підключення з інших пристроїв:
   Введіть в браузері: http://${primaryIP}:${this.port}
   
📱 Мобільні пристрої: Увімкніть мобільний hotspot або 
   підключіться до тієї ж Wi-Fi мережі
            `);
        });
    }
}

// Запуск сервера
if (require.main === module) {
    const port = process.env.PORT ? parseInt(process.env.PORT) : 3001;
    const server = new InformatorServer(port);
    server.start();
}

export default InformatorServer;