/**
 * H.264 Encoder Service для Backend
 * Кодує BGRA RAW -> H.264 для зменшення трафіку
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface EncoderConfig {
    width: number;
    height: number;
    fps: number;
    bitrate: number; // в Kbps
}

export class H264EncoderService extends EventEmitter {
    private ffmpegProcess: ChildProcess | null = null;
    private config: EncoderConfig;
    private frameCount = 0;

    constructor(config: EncoderConfig) {
        super();
        this.config = config;
    }

    start(): void {
        if (this.ffmpegProcess) {
            console.warn('[H264Encoder] Вже запущено');
            return;
        }

        const args = [
            '-f', 'rawvideo',
            '-pix_fmt', 'bgra',
            '-s', `${this.config.width}x${this.config.height}`,
            '-r', this.config.fps.toString(),
            '-i', 'pipe:0', // stdin
            
            // H.264 параметри
            '-c:v', 'libx264',
            '-preset', 'ultrafast', // Найшвидший для real-time
            '-tune', 'zerolatency', // Мінімальна затримка
            '-b:v', `${this.config.bitrate}k`,
            '-maxrate', `${this.config.bitrate * 1.5}k`,
            '-bufsize', `${this.config.bitrate * 2}k`,
            '-profile:v', 'baseline',
            '-level', '3.0',
            '-g', (this.config.fps * 2).toString(), // Keyframe кожні 2 секунди
            '-pix_fmt', 'yuv420p',
            
            // Output
            '-f', 'h264',
            '-an', // Без аудіо
            'pipe:1' // stdout
        ];

        console.log('[H264Encoder] Запуск FFmpeg:', args.join(' '));
        
        this.ffmpegProcess = spawn('ffmpeg', args, {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        this.ffmpegProcess.stdout?.on('data', (data: Buffer) => {
            this.emit('h264Data', data);
        });

        this.ffmpegProcess.stderr?.on('data', (data: Buffer) => {
            const message = data.toString();
            if (message.includes('frame=')) {
                // FFmpeg progress - ігноруємо або логуємо
                // console.log('[H264Encoder]', message.trim());
            } else if (message.includes('error') || message.includes('Error')) {
                console.error('[H264Encoder] ERROR:', message.trim());
            }
        });

        this.ffmpegProcess.on('close', (code) => {
            console.log(`[H264Encoder] Процес завершився з кодом ${code}`);
            this.ffmpegProcess = null;
            this.emit('close', code);
        });

        this.ffmpegProcess.on('error', (error) => {
            console.error('[H264Encoder] Помилка процесу:', error);
            this.emit('error', error);
        });

        console.log('[H264Encoder] ✅ Запущено');
    }

    encode(bgraFrame: Buffer): void {
        if (!this.ffmpegProcess || !this.ffmpegProcess.stdin) {
            console.warn('[H264Encoder] Енкодер не запущено');
            return;
        }

        try {
            this.ffmpegProcess.stdin.write(bgraFrame, (err) => {
                if (err) {
                    console.error('[H264Encoder] Помилка запису кадру:', err);
                }
            });
            this.frameCount++;
        } catch (error) {
            console.error('[H264Encoder] Помилка encode:', error);
        }
    }

    stop(): void {
        if (this.ffmpegProcess) {
            console.log('[H264Encoder] Зупинка...');
            this.ffmpegProcess.stdin?.end();
            this.ffmpegProcess.kill('SIGTERM');
            this.ffmpegProcess = null;
        }
    }

    getFrameCount(): number {
        return this.frameCount;
    }
}
