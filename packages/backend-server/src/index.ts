/**
 * Backend Server - головний файл
 * Приймає потік від Capture Client та розподіляє між Frontend глядачами
 */

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { WebSocketHandler } from './websocket-handler';
import { StreamManager } from './stream-manager';
import { ClientManager } from './client-manager';
import { logger } from './logger';
import { config } from './config';
import * as path from 'path';

class BackendServer {
    private app = express();
    private httpServer = createServer(this.app);
    private wss = new WebSocketServer({ server: this.httpServer });
    
    private streamManager: StreamManager;
    private clientManager: ClientManager;
    private websocketHandler: WebSocketHandler;

    constructor() {
        logger.info('🚀 Ініціалізація Backend Server...');

        this.streamManager = new StreamManager();
        this.clientManager = new ClientManager();
        this.websocketHandler = new WebSocketHandler(
            this.wss,
            this.streamManager,
            this.clientManager
        );

        this.setupExpress();
        this.setupGracefulShutdown();
    }

    private setupExpress(): void {
        // CORS
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST');
            res.header('Access-Control-Allow-Headers', 'Content-Type');
            next();
        });

        // JSON body parser
        this.app.use(express.json());

        // Static files (для Frontend)
        if (config.serveFrontend) {
            const frontendPath = path.join(__dirname, '../../frontend/public');
            this.app.use(express.static(frontendPath));
            logger.info(`📁 Serving frontend from: ${frontendPath}`);
        }

        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'ok',
                uptime: process.uptime(),
                timestamp: new Date().toISOString(),
                clients: {
                    total: this.clientManager.getClientCount(),
                    captureClients: this.clientManager.getCaptureClientCount(),
                    viewers: this.clientManager.getViewerCount()
                },
                streams: {
                    active: this.streamManager.getActiveStreamCount()
                }
            });
        });

        // API endpoints
        this.app.get('/api/streams', (req, res) => {
            const streams = this.streamManager.getActiveStreams();
            res.json({ streams });
        });

        this.app.get('/api/clients', (req, res) => {
            const clients = {
                total: this.clientManager.getClientCount(),
                captureClients: this.clientManager.getCaptureClientCount(),
                viewers: this.clientManager.getViewerCount()
            };
            res.json({ clients });
        });

        // Logs endpoint (для дебагінгу)
        if (config.environment === 'development') {
            this.app.get('/api/logs', (req, res) => {
                // TODO: Return recent logs
                res.json({ logs: [] });
            });
        }

        // 404 handler
        this.app.use((req, res) => {
            res.status(404).json({ error: 'Not found' });
        });

        // Error handler
        this.app.use((err: any, req: any, res: any, next: any) => {
            logger.error('❌ Express error:', err);
            res.status(500).json({ error: 'Internal server error' });
        });
    }

    private setupGracefulShutdown(): void {
        const shutdown = async (signal: string) => {
            logger.info(`\n⚠️ Отримано сигнал: ${signal}`);
            logger.info('👋 Завершення роботи сервера...');

            // Закриття WebSocket підключень
            this.wss.clients.forEach((client) => {
                client.close(1000, 'Server shutting down');
            });

            // Закриття HTTP сервера
            this.httpServer.close(() => {
                logger.info('✅ HTTP сервер закрито');
                process.exit(0);
            });

            // Форсоване завершення через 10 секунд
            setTimeout(() => {
                logger.error('❌ Форсоване завершення');
                process.exit(1);
            }, 10000);
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));

        process.on('unhandledRejection', (reason, promise) => {
            logger.error('❌ Unhandled Rejection:', reason);
        });

        process.on('uncaughtException', (error) => {
            logger.error('❌ Uncaught Exception:', error);
            shutdown('uncaughtException');
        });
    }

    public async start(): Promise<void> {
        return new Promise((resolve) => {
            this.httpServer.listen(config.port, config.host, () => {
                logger.info('✅ Backend Server запущено');
                logger.info(`🌐 HTTP: http://${config.host}:${config.port}`);
                logger.info(`🔌 WebSocket: ws://${config.host}:${config.port}`);
                logger.info('⏳ Очікування підключень...');
                resolve();
            });
        });
    }
}

// Головна функція
async function main() {
    try {
        const server = new BackendServer();
        await server.start();
    } catch (error) {
        logger.error('❌ Критична помилка:', error);
        process.exit(1);
    }
}

// Запуск
if (require.main === module) {
    main();
}

export { BackendServer };
