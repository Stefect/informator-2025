import WebSocket from 'ws';
import { performance } from 'perf_hooks';
import * as fs from 'fs';
import * as path from 'path';

// Імпорт нативного модуля
let screenCapture: any;
try {
    screenCapture = require('../screen_capture.node');
} catch (error) {
    console.error('❌ Нативний модуль не знайдено. Виконайте: npm run build:native');
    process.exit(1);
}

interface CaptureConfig {
    fps: number;
    quality: number;
    serverUrl: string;
    reconnectDelay: number;
    logPerformance: boolean;
    enableRecording: boolean;
    recordingPath: string;
}

interface PerformanceMetrics {
    captureTime: number;
    compressionTime: number;
    transmissionTime: number;
    frameSize: number;
    memoryUsage: NodeJS.MemoryUsage;
    totalFrames: number;
    droppedFrames: number;
}

class AdvancedScreenCaptureClient {
    private ws: WebSocket | null = null;
    private config: CaptureConfig;
    private captureInterval: NodeJS.Timeout | null = null;
    private isCapturing = false;
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private metrics: PerformanceMetrics;
    private lastFrameTime = 0;
    private isConnected = false;
    private recordingStream: fs.WriteStream | null = null;
    private startTime = Date.now();

    constructor(config: Partial<CaptureConfig> = {}) {
        this.config = {
            fps: 30, // Мінімум 30 FPS згідно вимог конкурсу
            quality: 75, // Знижуємо якість для кращої продуктивності
            serverUrl: 'ws://localhost:3001',
            reconnectDelay: 5000,
            logPerformance: true,
            enableRecording: false,
            recordingPath: './recordings',
            ...config
        };

        this.metrics = {
            captureTime: 0,
            compressionTime: 0,
            transmissionTime: 0,
            frameSize: 0,
            memoryUsage: process.memoryUsage(),
            totalFrames: 0,
            droppedFrames: 0
        };

        this.initializeNativeCapture();
        this.setupPerformanceLogging();
        this.setupRecording();
    }

    private initializeNativeCapture(): void {
        const success = screenCapture.initCapture();
        if (!success) {
            throw new Error('❌ Не вдалося ініціалізувати нативне захоплення екрану');
        }

        const screenInfo = screenCapture.getScreenInfo();
        console.log(`📺 Екран ініціалізовано: ${screenInfo.width}x${screenInfo.height}`);
    }

    private setupPerformanceLogging(): void {
        if (!this.config.logPerformance) return;

        setInterval(() => {
            this.logPerformanceMetrics();
        }, 10000); // Кожні 10 секунд
    }

    private setupRecording(): void {
        if (!this.config.enableRecording) return;

        if (!fs.existsSync(this.config.recordingPath)) {
            fs.mkdirSync(this.config.recordingPath, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const recordingFile = path.join(this.config.recordingPath, `capture-${timestamp}.mjpeg`);
        
        this.recordingStream = fs.createWriteStream(recordingFile);
        console.log(`🎥 Запис увімкнено: ${recordingFile}`);
    }

    public async connect(): Promise<void> {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            return;
        }

        try {
            this.ws = new WebSocket(this.config.serverUrl);

            this.ws.on('open', () => {
                console.log('🔗 Підключено до сервера');
                this.isConnected = true;
                this.clearReconnectTimeout();
                
                // Повідомляємо сервер про готовність
                this.ws?.send(JSON.stringify({
                    type: 'client_ready',
                    capabilities: {
                        screen: screenCapture.getScreenInfo(),
                        fps: this.config.fps,
                        quality: this.config.quality
                    }
                }));
            });

            this.ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.handleServerMessage(message);
                } catch (error) {
                    console.error('❌ Помилка обробки повідомлення сервера:', error);
                }
            });

            this.ws.on('close', () => {
                console.log('❌ З\'єднання закрито');
                this.isConnected = false;
                this.stopCapture();
                this.scheduleReconnect();
            });

            this.ws.on('error', (error) => {
                console.error('❌ Помилка WebSocket:', error);
                this.isConnected = false;
            });

        } catch (error) {
            console.error('❌ Помилка підключення:', error);
            this.scheduleReconnect();
        }
    }

    private handleServerMessage(message: any): void {
        switch (message.type) {
            case 'start_capture':
                console.log('🎬 Сервер запросив початок захоплення');
                this.startCapture();
                break;
                
            case 'stop_capture':
                console.log('⏹️ Сервер запросив зупинку захоплення');
                this.stopCapture();
                break;
                
            case 'config_update':
                console.log('⚙️ Оновлення конфігурації від сервера');
                this.updateConfig(message.config);
                break;
                
            case 'pong':
                // Heartbeat response
                break;
                
            default:
                console.log('📨 Невідоме повідомлення від сервера:', message.type);
        }
    }

    private updateConfig(newConfig: Partial<CaptureConfig>): void {
        const oldFps = this.config.fps;
        this.config = { ...this.config, ...newConfig };
        
        // Перезапуск захоплення при зміні FPS
        if (newConfig.fps && newConfig.fps !== oldFps && this.isCapturing) {
            this.stopCapture();
            setTimeout(() => this.startCapture(), 100);
        }
    }

    public startCapture(): void {
        if (this.isCapturing) return;

        console.log(`🎥 Початок захоплення екрану з ${this.config.fps} FPS`);
        this.isCapturing = true;
        this.lastFrameTime = performance.now();
        
        const frameInterval = 1000 / this.config.fps;
        
        this.captureInterval = setInterval(() => {
            this.captureAndSendFrame();
        }, frameInterval);
    }

    public stopCapture(): void {
        if (!this.isCapturing) return;

        console.log('⏹️ Зупинка захоплення екрану');
        this.isCapturing = false;
        
        if (this.captureInterval) {
            clearInterval(this.captureInterval);
            this.captureInterval = null;
        }
    }

    private captureAndSendFrame(): void {
        if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }

        const captureStart = performance.now();
        
        try {
            // Захоплюємо екран (DXGI вже оптимізований для пропуску пустих кадрів)
            const frameBuffer = screenCapture.captureScreen();
            
            if (!frameBuffer || frameBuffer.length === 0) {
                // Немає нового кадру або помилка - це нормально для DXGI
                return;
            }

            const captureEnd = performance.now();
            this.metrics.captureTime = captureEnd - captureStart;

            // Відправляємо на сервер
            const transmissionStart = performance.now();
            
            this.ws.send(frameBuffer);
            
            const transmissionEnd = performance.now();
            this.metrics.transmissionTime = transmissionEnd - transmissionStart;

            // Записуємо у файл (якщо увімкнено)
            if (this.recordingStream) {
                this.recordingStream.write(frameBuffer);
            }

            // Оновлюємо метрики
            this.metrics.frameSize = frameBuffer.length;
            this.metrics.totalFrames++;
            this.metrics.memoryUsage = process.memoryUsage();

            this.lastFrameTime = performance.now();

        } catch (error) {
            console.error('❌ Помилка захоплення кадру:', error);
            this.metrics.droppedFrames++;
        }
    }

    private logPerformanceMetrics(): void {
        const uptime = Date.now() - this.startTime;
        const fps = this.metrics.totalFrames / (uptime / 1000);
        const dropRate = (this.metrics.droppedFrames / this.metrics.totalFrames) * 100;

        console.log(`
📊 === МЕТРИКИ ПРОДУКТИВНОСТІ ===
⏱️  Час роботи: ${Math.round(uptime / 1000)}с
🎯 FPS (факт): ${fps.toFixed(2)}
📺 Кадрів відправлено: ${this.metrics.totalFrames}
❌ Втрачених кадрів: ${this.metrics.droppedFrames} (${dropRate.toFixed(1)}%)
⚡ Час захоплення: ${this.metrics.captureTime.toFixed(2)}мс
📡 Час передачі: ${this.metrics.transmissionTime.toFixed(2)}мс
📦 Розмір кадру: ${(this.metrics.frameSize / 1024).toFixed(1)}КБ
🧠 Пам'ять: ${(this.metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(1)}МБ
================================`);
    }

    private scheduleReconnect(): void {
        if (this.reconnectTimeout) return;
        
        console.log(`🔄 Спроба перепідключення через ${this.config.reconnectDelay}мс`);
        
        this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            this.connect();
        }, this.config.reconnectDelay);
    }

    private clearReconnectTimeout(): void {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
    }

    public disconnect(): void {
        console.log('🔌 Відключення від сервера');
        
        this.stopCapture();
        this.clearReconnectTimeout();
        
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        
        if (this.recordingStream) {
            this.recordingStream.end();
            this.recordingStream = null;
        }
        
        this.isConnected = false;
    }

    public cleanup(): void {
        this.disconnect();
        
        try {
            screenCapture.cleanupCapture();
        } catch (error) {
            console.error('❌ Помилка очищення нативного модуля:', error);
        }
    }

    public getMetrics(): PerformanceMetrics {
        return { ...this.metrics };
    }

    public setFPS(fps: number): void {
        this.config.fps = Math.max(1, Math.min(60, fps));
        
        if (this.isCapturing) {
            this.stopCapture();
            setTimeout(() => this.startCapture(), 100);
        }
    }
}

// Запуск клієнта
if (require.main === module) {
    console.log(`
🖥️ ===== INFORMATOR CAPTURE CLIENT =====
🎯 Професійна система захоплення екрану
⚡ Оптимізована для мінімального споживання ресурсів
========================================
    `);

    const client = new AdvancedScreenCaptureClient({
        fps: process.env.FPS ? parseInt(process.env.FPS) : 10,
        quality: 85,
        logPerformance: true,
        enableRecording: process.env.RECORD === 'true',
        serverUrl: process.env.SERVER_URL || 'ws://localhost:3001'
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Отримано сигнал зупинки...');
        client.cleanup();
        setTimeout(() => process.exit(0), 1000);
    });

    process.on('SIGTERM', () => {
        console.log('\n🛑 Отримано сигнал завершення...');
        client.cleanup();
        process.exit(0);
    });

    // Підключення
    client.connect().catch(console.error);

    // Команди через клавіатуру
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', (key) => {
        const keyStr = key.toString();
        
        switch (keyStr) {
            case 's':
                client.startCapture();
                break;
            case 'q':
                client.stopCapture();
                break;
            case '+':
                const currentFPS = client.getMetrics().totalFrames > 0 ? 
                    client.getMetrics().totalFrames / ((Date.now() - client['startTime']) / 1000) : 10;
                client.setFPS(Math.min(60, Math.round(currentFPS) + 1));
                console.log(`📈 FPS збільшено`);
                break;
            case '-':
                const currentFPS2 = client.getMetrics().totalFrames > 0 ? 
                    client.getMetrics().totalFrames / ((Date.now() - client['startTime']) / 1000) : 10;
                client.setFPS(Math.max(1, Math.round(currentFPS2) - 1));
                console.log(`📉 FPS зменшено`);
                break;
            case '\u0003': // Ctrl+C
                client.cleanup();
                process.exit(0);
                break;
        }
    });

    console.log(`
⌨️  Команди управління:
   s - Старт захоплення
   q - Стоп захоплення  
   + - Збільшити FPS
   - - Зменшити FPS
   Ctrl+C - Вихід
    `);
}

export default AdvancedScreenCaptureClient;