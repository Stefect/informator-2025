import 'dotenv/config';
import NodeMediaServer from 'node-media-server';
import path from 'path';
import fs from 'fs';
import { connectDatabase } from './database/connection';
import { Stream, Recording, IStream } from './database/models';
import { logger, log, rtmpLogger } from './logger';

// Створюємо директорії
const mediaRoot = path.join(__dirname, '..', 'media');
const recordingsPath = path.join(mediaRoot, 'recordings');
const hlsPath = path.join(mediaRoot, 'hls');

[mediaRoot, recordingsPath, hlsPath].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.info(`Created directory: ${dir}`);
    }
});

interface StreamInfo {
    id: string;
    app: string;
    stream: string;
    startTime: number;
    viewers: number;
    recordingPath?: string;
}

class RTMPServerManager {
    private nms: any;
    private activeStreams: Map<string, StreamInfo> = new Map();

    constructor() {
        const config = {
            rtmp: {
                port: 1935,
                chunk_size: 60000, // Larger chunks for better throughput
                gop_cache: true, // Cache GOP for faster startup
                ping: 30,
                ping_timeout: 60
            },
            http: {
                port: 8888, // Змінено з 8000 на 8888 щоб уникнути конфліктів
                allow_origin: '*',
                mediaroot: mediaRoot
            },
            trans: {
                ffmpeg: 'C:\\ffmpeg\\bin\\ffmpeg.exe',
                tasks: [
                    {
                        app: 'live',
                        hls: true,
                        hlsFlags: '[hls_time=2:hls_list_size=5:hls_flags=delete_segments+append_list]',
                        hlsKeep: true,
                        dash: false,
                        // Оптимізація FFmpeg
                        ac: 'aac', // Audio codec
                        acParam: ['-b:a', '128k'], // Audio bitrate
                        vc: 'libx264', // Video codec
                        vcParams: [
                            '-preset', 'veryfast', // Fast encoding
                            '-tune', 'zerolatency', // Low latency
                            '-g', '60', // GOP size (2 seconds at 30fps)
                            '-sc_threshold', '0', // Disable scene detection
                            '-b:v', '2500k', // Video bitrate
                            '-maxrate', '3000k',
                            '-bufsize', '6000k',
                            '-threads', '4' // CPU threads
                        ]
                    }
                ]
            }
        };

        this.nms = new NodeMediaServer(config);
        this.setupEvents();
    }

    private setupEvents(): void {
        // Коли стрім починається
        this.nms.on('prePublish', (id: string, StreamPath: string, args: any) => {
            logger.info(`[RTMP] Stream publish attempt: ${StreamPath}`, args);
            
            // Можна додати авторизацію за ключем
            const streamKey = args.key || '';
            // if (!this.isValidStreamKey(streamKey)) {
            //     logger.warn(`Invalid stream key: ${streamKey}`);
            //     return this.nms.reject(id);
            // }

            const [app, stream] = StreamPath.split('/').filter(Boolean);
            
            const streamInfo: StreamInfo = {
                id,
                app,
                stream,
                startTime: Date.now(),
                viewers: 0
            };

            this.activeStreams.set(id, streamInfo);
            logger.info(`[RTMP] ✅ Stream started: ${app}/${stream}`);
        });

        // Коли стрім публікується
        this.nms.on('postPublish', (id: string, StreamPath: string, args: any) => {
            logger.info(`[RTMP] Stream is now live: ${StreamPath}`);
            
            // Початок запису
            this.startRecording(id, StreamPath);
        });

        // Коли стрім завершується
        this.nms.on('donePublish', (id: string, StreamPath: string, args: any) => {
            logger.info(`[RTMP] Stream ended: ${StreamPath}`);
            
            const streamInfo = this.activeStreams.get(id);
            if (streamInfo) {
                this.stopRecording(id);
                this.activeStreams.delete(id);
            }
        });

        // Коли глядач підключається
        this.nms.on('prePlay', (id: string, StreamPath: string, args: any) => {
            logger.info(`[RTMP] Viewer connected: ${StreamPath}`);
        });

        // Коли глядач відключається
        this.nms.on('donePlay', (id: string, StreamPath: string, args: any) => {
            logger.info(`[RTMP] Viewer disconnected: ${StreamPath}`);
        });
    }

    private startRecording(id: string, StreamPath: string): void {
        const streamInfo = this.activeStreams.get(id);
        if (!streamInfo) return;

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${streamInfo.app}_${streamInfo.stream}_${timestamp}.mp4`;
        const recordingPath = path.join(recordingsPath, filename);

        streamInfo.recordingPath = recordingPath;
        
        logger.info(`[RECORDING] Started recording: ${filename}`);
        
        // Node-Media-Server автоматично записує, якщо налаштовано trans
        // Але ми також збережемо метадані
        this.saveStreamMetadata(streamInfo);
    }

    private stopRecording(id: string): void {
        const streamInfo = this.activeStreams.get(id);
        if (!streamInfo || !streamInfo.recordingPath) return;

        const duration = Math.floor((Date.now() - streamInfo.startTime) / 1000);
        
        logger.info(`[RECORDING] Stopped recording: ${streamInfo.recordingPath} (Duration: ${duration}s)`);
        
        // Оновлюємо метадані з тривалістю
        this.saveStreamMetadata(streamInfo, duration);
    }

    private saveStreamMetadata(streamInfo: StreamInfo, duration?: number): void {
        const metaPath = path.join(__dirname, '..', 'streams.json');
        
        let streams: any[] = [];
        if (fs.existsSync(metaPath)) {
            streams = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        }

        const existingIndex = streams.findIndex(s => s.id === streamInfo.id);
        
        const metadata = {
            id: streamInfo.id,
            app: streamInfo.app,
            stream: streamInfo.stream,
            startTime: streamInfo.startTime,
            endTime: duration ? Date.now() : null,
            duration: duration || null,
            recordingPath: streamInfo.recordingPath,
            hlsPath: `${streamInfo.app}/${streamInfo.stream}/index.m3u8`
        };

        if (existingIndex >= 0) {
            streams[existingIndex] = metadata;
        } else {
            streams.push(metadata);
        }

        fs.writeFileSync(metaPath, JSON.stringify(streams, null, 2));
        logger.info(`[METADATA] Saved stream metadata: ${streamInfo.id}`);
    }

    public getActiveStreams(): StreamInfo[] {
        return Array.from(this.activeStreams.values());
    }

    public async start(): Promise<void> {
        // Connect to MongoDB first
        await connectDatabase();
        
        this.nms.run();
        
        const domain = process.env.DOMAIN || 'capturestream.com';
        const rtmpUrl = process.env.RTMP_URL || `rtmp://${domain}:1935/live`;
        const hlsUrl = process.env.HLS_URL || `http://${domain}:8888/live`;
        
        log.start(`
╔════════════════════════════════════════╗
║      📡 RTMP SERVER v1.0               ║
║      🌐 capturestream.com              ║
║                                        ║
║  📺 RTMP: ${rtmpUrl}    ║
║  🌐 HLS:  ${hlsUrl}         ║
║  🎬 FLV:  http://${domain}:8888/live    ║
║                                        ║
║  📹 Recordings: ${recordingsPath}          ║
║  🎬 HLS Segments: ${hlsPath}               ║
║  💾 MongoDB: Connected ✅              ║
╚════════════════════════════════════════╝

🎥 OBS Studio Configuration:
   Server:     ${rtmpUrl}
   Stream Key: your_stream_name
   
🌐 Production URLs:
   HLS Player: http://${domain}:8888/live/your_stream_name/index.m3u8
   FLV Stream: http://${domain}:8888/live/your_stream_name.flv
   
🏠 Local URLs:
   RTMP: rtmp://localhost:1935/live
   HLS:  http://localhost:8888/live
        `);
    }

    public stop(): void {
        this.nms.stop();
        logger.info('RTMP server stopped');
    }
}

export default RTMPServerManager;

// Запуск сервера
if (require.main === module) {
    const rtmpServer = new RTMPServerManager();
    rtmpServer.start().catch((error) => {
        log.error('Failed to start RTMP server', { error });
        process.exit(1);
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
        log.stop('Shutting down RTMP server...');
        rtmpServer.stop();
        process.exit(0);
    });
}
