/**
 * Менеджер потоків
 * Керує активними потоками від Capture Clients та розподіляє їх між Viewers
 */

import { EventEmitter } from 'events';
import { logger } from './logger';
import { STREAM_CONFIG, FRAME_CODECS } from './constants';
import { generateId } from './utils';

export interface StreamInfo {
    streamId: string;
    captureClientId: string;
    startedAt: Date;
    isActive: boolean;
    viewerIds: Set<string>;
    metadata?: {
        width: number;
        height: number;
        fps: number;
        codec: typeof FRAME_CODECS.BGRA | typeof FRAME_CODECS.JPEG | typeof FRAME_CODECS.H264;
    };
    stats: {
        framesReceived: number;
        framesSent: number;
        bytesReceived: number;
        bytesSent: number;
    };
}

export interface FrameMetadata {
    width: number;
    height: number;
    timestamp: number;
    frameNumber: number;
    size: number;
}

export class StreamManager extends EventEmitter {
    private streams = new Map<string, StreamInfo>();
    
    // Мапа для швидкого пошуку потоку за clientId
    private clientToStream = new Map<string, string>();

    constructor() {
        super();
        logger.info('📺 StreamManager ініціалізовано');
    }

    public createStream(captureClientId: string): string {
        const streamId = generateId('stream');

        const streamInfo: StreamInfo = {
            streamId,
            captureClientId,
            startedAt: new Date(),
            isActive: true,
            viewerIds: new Set(),
            stats: {
                framesReceived: 0,
                framesSent: 0,
                bytesReceived: 0,
                bytesSent: 0
            }
        };

        this.streams.set(streamId, streamInfo);
        this.clientToStream.set(captureClientId, streamId);
        
        logger.info(`📹 Створено потік: ${streamId} від клієнта ${captureClientId}`);
        this.emit('stream_created', streamInfo);

        return streamId;
    }

    public removeStream(streamId: string): void {
        const stream = this.streams.get(streamId);
        if (stream) {
            this.clientToStream.delete(stream.captureClientId);
            this.streams.delete(streamId);
            
            logger.info(`🗑️ Потік видалено: ${streamId}`);
            this.emit('stream_removed', streamId);
        }
    }

    public getStreamByCaptureClient(captureClientId: string): StreamInfo | undefined {
        const streamId = this.clientToStream.get(captureClientId);
        return streamId ? this.streams.get(streamId) : undefined;
    }

    public getStream(streamId: string): StreamInfo | undefined {
        return this.streams.get(streamId);
    }

    public addViewer(streamId: string, viewerId: string): boolean {
        const stream = this.streams.get(streamId);
        if (stream) {
            stream.viewerIds.add(viewerId);
            logger.info(`👁️ Глядач ${viewerId} підключився до потоку ${streamId} (глядачів: ${stream.viewerIds.size})`);
            this.emit('viewer_added', { streamId, viewerId });
            return true;
        }
        return false;
    }

    public removeViewer(streamId: string, viewerId: string): void {
        const stream = this.streams.get(streamId);
        if (stream) {
            stream.viewerIds.delete(viewerId);
            logger.info(`👁️ Глядач ${viewerId} відключився від потоку ${streamId}`);
            this.emit('viewer_removed', { streamId, viewerId });

            // Якщо немає більше глядачів, можна сповістити Capture Client
            if (stream.viewerIds.size === 0) {
                logger.info(`⚠️ У потоку ${streamId} більше немає глядачів`);
                this.emit('no_viewers', streamId);
            }
        }
    }

    public updateStreamMetadata(streamId: string, metadata: FrameMetadata): void {
        const stream = this.streams.get(streamId);
        if (stream) {
            stream.metadata = {
                width: metadata.width,
                height: metadata.height,
                fps: 0, // Розрахуємо окремо
                codec: FRAME_CODECS.JPEG
            };
        }
    }

    public recordFrameReceived(streamId: string, frameSize: number): void {
        const stream = this.streams.get(streamId);
        if (stream) {
            stream.stats.framesReceived++;
            stream.stats.bytesReceived += frameSize;
        }
    }

    public recordFrameSent(streamId: string, frameSize: number, viewerCount: number): void {
        const stream = this.streams.get(streamId);
        if (stream) {
            stream.stats.framesSent += viewerCount;
            stream.stats.bytesSent += frameSize * viewerCount;
        }
    }

    public getViewersForStream(streamId: string): string[] {
        const stream = this.streams.get(streamId);
        return stream ? Array.from(stream.viewerIds) : [];
    }

    public getActiveStreams(): StreamInfo[] {
        return Array.from(this.streams.values()).filter(s => s.isActive);
    }

    public getActiveStreamCount(): number {
        return this.getActiveStreams().length;
    }

    public hasViewers(streamId: string): boolean {
        const stream = this.streams.get(streamId);
        return stream ? stream.viewerIds.size > 0 : false;
    }

    public getStreamStats(streamId: string): StreamInfo['stats'] | undefined {
        const stream = this.streams.get(streamId);
        return stream?.stats;
    }
}
