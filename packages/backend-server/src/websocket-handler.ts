/**
 * Обробник WebSocket підключень
 * Керує комунікацією між Capture Clients та Viewers
 */

import WebSocket, { WebSocketServer } from 'ws';
import { ClientManager, ClientType } from './client-manager';
import { StreamManager, FrameMetadata } from './stream-manager';
import { JPEGCompressor } from './jpeg-compressor';
import { logger } from './logger';
import { MESSAGE_TYPES, CLIENT_TYPES, ERRORS, JPEG_CONFIG, FRAME_CODECS } from './constants';
import { isValidMessage, safeJSONParse, generateId, formatCompressionRatio } from './utils';
import type { BaseMessage, ClientMessage } from './types';

export class WebSocketHandler {
    private wss: WebSocketServer;
    private streamManager: StreamManager;
    private clientManager: ClientManager;
    private compressor: JPEGCompressor;

    // Тимчасове сховище для очікування бінарних даних після метаданих
    private pendingFrames = new Map<string, FrameMetadata>();

    constructor(
        wss: WebSocketServer,
        streamManager: StreamManager,
        clientManager: ClientManager
    ) {
        this.wss = wss;
        this.streamManager = streamManager;
        this.clientManager = clientManager;
        this.compressor = new JPEGCompressor({ 
            quality: JPEG_CONFIG.QUALITY, 
            chroma: JPEG_CONFIG.CHROMA_SUBSAMPLING 
        });

        this.setupWebSocket();
        this.setupStreamEvents();
    }

    private setupWebSocket(): void {
        this.wss.on('connection', (ws: WebSocket) => {
            const clientId = this.clientManager.addClient(ws);

            ws.on('message', (data: WebSocket.Data) => {
                this.handleMessage(clientId, data);
            });

            ws.on('close', () => {
                this.handleDisconnect(clientId);
            });

            ws.on('error', (error) => {
                logger.error(`❌ WebSocket помилка для ${clientId}:`, error);
            });

            // Відправка вітального повідомлення
            this.sendMessage(ws, {
                type: MESSAGE_TYPES.WELCOME,
                clientId,
                timestamp: Date.now()
            });
        });

        logger.info('🔌 WebSocket server налаштовано');
    }

    private setupStreamEvents(): void {
        // Коли немає глядачів, повідомити Capture Client зупинити захоплення
        this.streamManager.on('no_viewers', (streamId: string) => {
            const stream = this.streamManager.getStream(streamId);
            if (stream) {
                const captureClient = this.clientManager.getClient(stream.captureClientId);
                if (captureClient) {
                    this.sendCommand(captureClient.ws, {
                        type: MESSAGE_TYPES.STOP_CAPTURE
                    });
                }
            }
        });

        // Коли додається перший глядач, запустити захоплення
        this.streamManager.on('viewer_added', ({ streamId, viewerId }) => {
            const stream = this.streamManager.getStream(streamId);
            if (stream && stream.viewerIds.size === 1) {
                // Перший глядач - запустити захоплення
                const captureClient = this.clientManager.getClient(stream.captureClientId);
                if (captureClient) {
                    this.sendCommand(captureClient.ws, {
                        type: MESSAGE_TYPES.START_CAPTURE
                    });
                }
            }
        });
    }

    private async handleMessage(clientId: string, data: WebSocket.Data): Promise<void> {
        const client = this.clientManager.getClient(clientId);
        if (!client) return;

        this.clientManager.updateActivity(clientId);

        // Детальне логування для дебагу
        logger.info(`📨 Отримано дані від ${clientId}, тип: ${typeof data}, isBuffer: ${Buffer.isBuffer(data)}`);

        // Перевірка чи це текстове або бінарне повідомлення
        if (Buffer.isBuffer(data) || data instanceof ArrayBuffer) {
            // Спробувати розпарсити як JSON (можливо це текст в Buffer)
            try {
                const text = data.toString();
                const message = JSON.parse(text);
                logger.info(`📥 Розпарсено JSON з Buffer: ${message.type}`);
                this.handleTextMessage(clientId, message);
                return;
            } catch {
                // Це справді бінарні дані - кадр відео
                await this.handleBinaryFrame(clientId, data as Buffer);
            }
        } else {
            // Текстове повідомлення - JSON
            try {
                const message = JSON.parse(data.toString());
                this.handleTextMessage(clientId, message);
            } catch (error) {
                logger.error(`❌ Помилка парсингу JSON від ${clientId}:`, error);
            }
        }
    }

    private handleTextMessage(clientId: string, message: any): void {
        // Валідація повідомлення
        if (!isValidMessage(message)) {
            logger.warn(`⚠️ Невалідне повідомлення від ${clientId}:`, message);
            return;
        }

        logger.info(`📥 Повідомлення від ${clientId}: ${message.type}`);

        switch (message.type) {
            case MESSAGE_TYPES.IDENTIFICATION:
                this.handleIdentification(clientId, message);
                break;

            case MESSAGE_TYPES.FRAME_METADATA:
                this.handleFrameMetadata(clientId, message);
                break;

            case MESSAGE_TYPES.JOIN_STREAM:
                this.handleJoinStream(clientId, message);
                break;

            case MESSAGE_TYPES.HEARTBEAT:
                this.handleHeartbeat(clientId, message);
                break;

            case MESSAGE_TYPES.METRICS:
                this.handleMetrics(clientId, message);
                break;

            default:
                logger.warn(`⚠️ Невідомий тип повідомлення від ${clientId}:`, message.type);
        }
    }

    private handleIdentification(clientId: string, message: any): void {
        const clientType: ClientType = message.clientType || CLIENT_TYPES.UNKNOWN;
        this.clientManager.setClientType(clientId, clientType);
        this.clientManager.setClientMetadata(clientId, message);

        logger.info(`🆔 Клієнт ${clientId} ідентифіковано як: ${clientType}`);

        if (clientType === CLIENT_TYPES.CAPTURE) {
            // Створити потік для цього Capture Client
            const streamId = this.streamManager.createStream(clientId);
            
            // Відправити streamId назад клієнту
            const client = this.clientManager.getClient(clientId);
            if (client) {
                this.sendMessage(client.ws, {
                    type: MESSAGE_TYPES.STREAM_CREATED,
                    streamId,
                    timestamp: Date.now()
                });
            }
        }
    }

    private handleFrameMetadata(clientId: string, message: any): void {
        const metadata: FrameMetadata = {
            width: message.width,
            height: message.height,
            timestamp: message.timestamp,
            frameNumber: message.frameNumber,
            size: message.size
        };

        // Зберегти метадані, очікуємо бінарний кадр наступним повідомленням
        this.pendingFrames.set(clientId, metadata);

        // Оновити метадані потоку
        const stream = this.streamManager.getStreamByCaptureClient(clientId);
        if (stream) {
            this.streamManager.updateStreamMetadata(stream.streamId, metadata);
        }
    }

    private async handleBinaryFrame(clientId: string, frameData: Buffer): Promise<void> {
        const metadata = this.pendingFrames.get(clientId);
        if (!metadata) {
            logger.warn(`⚠️ Отримано кадр без метаданих від ${clientId}`);
            return;
        }

        this.pendingFrames.delete(clientId);

        // Знайти потік для цього Capture Client
        const stream = this.streamManager.getStreamByCaptureClient(clientId);
        if (!stream) {
            logger.warn(`⚠️ Потік не знайдено для ${clientId}`);
            return;
        }

        // Записати статистику (оригінальний розмір)
        this.streamManager.recordFrameReceived(stream.streamId, frameData.length);

        // Стиснути BGRA -> JPEG перед відправкою
        let compressedFrame: Buffer;
        let codec: typeof FRAME_CODECS.BGRA | typeof FRAME_CODECS.JPEG = FRAME_CODECS.BGRA;
        
        try {
            compressedFrame = await this.compressor.compress(
                frameData,
                metadata.width,
                metadata.height
            );
            codec = FRAME_CODECS.JPEG;
        } catch (error) {
            logger.error('❌ Помилка стиснення, відправляємо оригінал:', error);
            compressedFrame = frameData; // Fallback до RAW
        }

        // Розіслати кадр усім глядачам
        const viewers = this.streamManager.getViewersForStream(stream.streamId);
        
        let sentCount = 0;
        for (const viewerId of viewers) {
            const viewer = this.clientManager.getClient(viewerId);
            if (viewer && viewer.ws.readyState === WebSocket.OPEN) {
                // Відправити метадані (з оновленим codec та size)
                this.sendMessage(viewer.ws, {
                    type: MESSAGE_TYPES.FRAME_METADATA,
                    ...metadata,
                    size: compressedFrame.length,
                    codec: codec
                });

                // Відправити бінарні дані (стиснуті)
                viewer.ws.send(compressedFrame, (error) => {
                    if (error) {
                        logger.error(`❌ Помилка відправки кадру глядачу ${viewerId}:`, error);
                    }
                });

                sentCount++;
            }
        }

        // Записати статистику відправки (стиснутий розмір)
        this.streamManager.recordFrameSent(stream.streamId, compressedFrame.length, sentCount);

        logger.debug(`📤 Кадр #${metadata.frameNumber} розіслано ${sentCount} глядачам (${codec})`);
    }

    private handleJoinStream(clientId: string, message: any): void {
        const streamId = message.streamId;
        
        if (!streamId) {
            logger.warn(`⚠️ Клієнт ${clientId} намагається приєднатися без streamId`);
            const client = this.clientManager.getClient(clientId);
            if (client) {
                this.sendMessage(client.ws, {
                    type: MESSAGE_TYPES.ERROR,
                    message: ERRORS.MISSING_STREAM_ID,
                    timestamp: Date.now()
                });
            }
            return;
        }

        // Встановити тип клієнта як viewer
        this.clientManager.setClientType(clientId, CLIENT_TYPES.VIEWER);

        // Додати до потоку
        const success = this.streamManager.addViewer(streamId, clientId);

        const client = this.clientManager.getClient(clientId);
        if (client) {
            if (success) {
                this.sendMessage(client.ws, {
                    type: MESSAGE_TYPES.JOINED_STREAM,
                    streamId,
                    timestamp: Date.now()
                });
            } else {
                this.sendMessage(client.ws, {
                    type: MESSAGE_TYPES.ERROR,
                    message: ERRORS.STREAM_NOT_FOUND,
                    timestamp: Date.now()
                });
            }
        }
    }

    private handleHeartbeat(clientId: string, message: any): void {
        const client = this.clientManager.getClient(clientId);
        if (client) {
            this.sendMessage(client.ws, {
                type: MESSAGE_TYPES.PONG,
                timestamp: Date.now()
            });
        }
    }

    private handleMetrics(clientId: string, message: any): void {
        logger.debug(`📊 Метрики від ${clientId}:`, message.data);
        // TODO: Зберегти метрики в БД або логах
    }

    private handleDisconnect(clientId: string): void {
        const client = this.clientManager.getClient(clientId);
        if (!client) return;

        logger.info(`🔌 Клієнт відключився: ${clientId} (${client.type})`);

        if (client.type === CLIENT_TYPES.CAPTURE) {
            // Видалити потік
            const stream = this.streamManager.getStreamByCaptureClient(clientId);
            if (stream) {
                // Повідомити всіх глядачів про закриття потоку
                const viewers = this.streamManager.getViewersForStream(stream.streamId);
                for (const viewerId of viewers) {
                    const viewer = this.clientManager.getClient(viewerId);
                    if (viewer) {
                        this.sendMessage(viewer.ws, {
                            type: MESSAGE_TYPES.STREAM_ENDED,
                            streamId: stream.streamId,
                            timestamp: Date.now()
                        });
                    }
                }

                this.streamManager.removeStream(stream.streamId);
            }
        } else if (client.type === CLIENT_TYPES.VIEWER) {
            // Видалити з потоку
            for (const stream of this.streamManager.getActiveStreams()) {
                if (stream.viewerIds.has(clientId)) {
                    this.streamManager.removeViewer(stream.streamId, clientId);
                }
            }
        }

        this.clientManager.removeClient(clientId);
    }

    private sendMessage(ws: WebSocket, message: any): void {
        if (ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(JSON.stringify(message));
            } catch (error) {
                logger.error('❌ Помилка відправки повідомлення:', error);
            }
        }
    }

    private sendCommand(ws: WebSocket, command: any): void {
        this.sendMessage(ws, {
            type: MESSAGE_TYPES.COMMAND,
            command,
            timestamp: Date.now()
        });
    }
}
