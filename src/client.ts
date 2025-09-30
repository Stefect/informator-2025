import WebSocket from 'ws';

class ScreenCaptureClient {
    private ws: WebSocket | null = null;
    private serverUrl: string;
    private reconnectInterval: number = 5000;
    private captureInterval: NodeJS.Timeout | null = null;

    constructor(serverUrl: string = 'ws://localhost:3001') {
        this.serverUrl = serverUrl;
        this.connect();
    }

    private connect(): void {
        try {
            this.ws = new WebSocket(this.serverUrl);
            
            this.ws.on('open', () => {
                console.log('[Client] Підключено до сервера');
                this.startCapture();
            });

            this.ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    console.log('[Client] Отримано:', message.type);
                } catch (error) {
                    console.error('[Client] Помилка обробки повідомлення:', error);
                }
            });

            this.ws.on('close', () => {
                console.log('[Client] З\'єднання закрито. Спроба перепідключення...');
                this.stopCapture();
                setTimeout(() => this.connect(), this.reconnectInterval);
            });

            this.ws.on('error', (error) => {
                console.error('[Client] Помилка WebSocket:', error);
            });

        } catch (error) {
            console.error('[Client] Помилка підключення:', error);
            setTimeout(() => this.connect(), this.reconnectInterval);
        }
    }

    private startCapture(): void {
        if (this.captureInterval) return;

        this.captureInterval = setInterval(() => {
            this.captureScreen();
        }, 1000 / 10); // 10 FPS
    }

    private stopCapture(): void {
        if (this.captureInterval) {
            clearInterval(this.captureInterval);
            this.captureInterval = null;
        }
    }

    private captureScreen(): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        try {
            // Симуляція захоплення екрану (в реальному проекті тут буде нативний код)
            const mockScreenData = {
                type: 'screen_data',
                timestamp: new Date().toISOString(),
                width: 1920,
                height: 1080,
                data: Buffer.from('mock_screen_data').toString('base64')
            };

            this.ws.send(JSON.stringify(mockScreenData));
        } catch (error) {
            console.error('[Client] Помилка захоплення екрану:', error);
        }
    }

    public disconnect(): void {
        this.stopCapture();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}

// Запуск клієнта
if (require.main === module) {
    console.log('🖥️ Запуск Informator Client...');
    const client = new ScreenCaptureClient();

    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n[Client] Завершення роботи...');
        client.disconnect();
        process.exit(0);
    });
}

export default ScreenCaptureClient;