const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 3001;
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

console.log('🚀 Запуск сервера відео-стрімінгу з робочого столу...');

// Статичні файли
app.use(express.static(path.join(__dirname, 'public')));

// Головна сторінка з відео-плеєром
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="uk">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Live Desktop Stream - Informator</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                margin: 0;
                padding: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                min-height: 100vh;
            }
            .container {
                max-width: 1200px;
                margin: 0 auto;
                text-align: center;
            }
            h1 {
                margin-bottom: 30px;
                font-size: 2.5rem;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
            }
            .status {
                background: rgba(255,255,255,0.1);
                padding: 15px;
                border-radius: 10px;
                margin: 20px 0;
                backdrop-filter: blur(10px);
            }
            .video-container {
                background: rgba(0,0,0,0.3);
                padding: 20px;
                border-radius: 15px;
                margin: 20px 0;
                backdrop-filter: blur(10px);
                box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            }
            #videoPlayer {
                width: 100%;
                max-width: 1000px;
                height: auto;
                border-radius: 10px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            }
            .controls {
                margin: 20px 0;
            }
            button {
                background: #4CAF50;
                color: white;
                border: none;
                padding: 12px 24px;
                margin: 0 10px;
                border-radius: 25px;
                font-size: 16px;
                cursor: pointer;
                transition: all 0.3s ease;
                box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            }
            button:hover {
                background: #45a049;
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(0,0,0,0.3);
            }
            button:disabled {
                background: #cccccc;
                cursor: not-allowed;
                transform: none;
            }
            .success { color: #4CAF50; font-weight: bold; }
            .error { color: #f44336; font-weight: bold; }
            .info {
                background: rgba(255,255,255,0.1);
                padding: 10px;
                border-radius: 10px;
                margin: 10px 0;
                backdrop-filter: blur(10px);
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🖥️ Live Desktop Stream - Informator</h1>
            <div class="status" id="status">🔄 Підготовка до підключення...</div>
            <div class="info" id="info">ℹ️ Натисніть "Запустити стрім" для початку трансляції</div>
            
            <div class="video-container">
                <video id="videoPlayer" controls autoplay muted>
                    <source id="videoSource" type="video/webm">
                    Ваш браузер не підтримує відео-елемент.
                </video>
            </div>
            
            <div class="controls">
                <button id="startStream" onclick="startStreaming()">▶️ Запустити стрім</button>
                <button id="stopStream" onclick="stopStreaming()" disabled>⏹️ Зупинити стрім</button>
            </div>
        </div>

        <script>
            const statusEl = document.getElementById('status');
            const infoEl = document.getElementById('info');
            const videoPlayer = document.getElementById('videoPlayer');
            const videoSource = document.getElementById('videoSource');
            const startBtn = document.getElementById('startStream');
            const stopBtn = document.getElementById('stopStream');

            let ws = null;
            let mediaSource = null;
            let sourceBuffer = null;
            let isStreaming = false;

            function connectWebSocket() {
                ws = new WebSocket('ws://localhost:3001/stream');
                
                ws.onopen = function() {
                    statusEl.innerHTML = '<span class="success">✅ З\\'єднання встановлено</span>';
                    infoEl.innerHTML = '📡 Готовий до отримання відео-стріму';
                    startBtn.disabled = false;
                };

                ws.onmessage = function(event) {
                    if (event.data instanceof Blob) {
                        // Отримуємо відео-дані та додаємо їх до MediaSource
                        if (sourceBuffer && !sourceBuffer.updating) {
                            event.data.arrayBuffer().then(buffer => {
                                sourceBuffer.appendBuffer(buffer);
                            });
                        }
                    }
                };

                ws.onclose = function() {
                    statusEl.innerHTML = '<span class="error">❌ З\\'єднання розірвано</span>';
                    infoEl.innerHTML = '🔄 Переподключення...';
                    startBtn.disabled = true;
                    stopBtn.disabled = true;
                    if (!isStreaming) {
                        setTimeout(connectWebSocket, 3000);
                    }
                };

                ws.onerror = function(error) {
                    statusEl.innerHTML = '<span class="error">❌ Помилка з\\'єднання</span>';
                    console.error('WebSocket помилка:', error);
                };
            }

            function startStreaming() {
                if (!ws || ws.readyState !== WebSocket.OPEN) {
                    infoEl.innerHTML = '<span class="error">❌ Немає з\\'єднання з сервером</span>';
                    return;
                }

                // Створюємо MediaSource для відео-стріму
                mediaSource = new MediaSource();
                videoSource.src = URL.createObjectURL(mediaSource);

                mediaSource.addEventListener('sourceopen', function() {
                    sourceBuffer = mediaSource.addSourceBuffer('video/webm; codecs="vp8"');
                    
                    sourceBuffer.addEventListener('updateend', function() {
                        if (!isStreaming && mediaSource.readyState === 'open') {
                            mediaSource.endOfStream();
                        }
                    });
                });

                // Запускаємо стрім
                ws.send(JSON.stringify({ command: 'start_stream' }));
                isStreaming = true;
                startBtn.disabled = true;
                stopBtn.disabled = false;
                statusEl.innerHTML = '<span class="success">🔴 Стрім активний</span>';
                infoEl.innerHTML = '📹 Отримання live відео з робочого столу...';
            }

            function stopStreaming() {
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ command: 'stop_stream' }));
                }
                
                isStreaming = false;
                startBtn.disabled = false;
                stopBtn.disabled = true;
                statusEl.innerHTML = '<span class="success">⏸️ Стрім зупинено</span>';
                infoEl.innerHTML = '📡 Готовий до запуску нового стріму';

                if (mediaSource && mediaSource.readyState === 'open') {
                    mediaSource.endOfStream();
                }
            }

            // Автопідключення при завантаженні сторінки
            connectWebSocket();
        </script>
    </body>
    </html>
    `);
});

// WebSocket обробка для відео-стріму
wss.on('connection', (ws, req) => {
    console.log('🔗 Новий клієнт підключився для відео-стріму');
    
    let ffmpegProcess = null;
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('📩 Отримано команду:', data.command);
            
            if (data.command === 'start_stream') {
                startDesktopCapture(ws);
            } else if (data.command === 'stop_stream') {
                stopDesktopCapture();
            }
        } catch (error) {
            console.error('❌ Помилка обробки повідомлення:', error);
        }
    });

    ws.on('close', () => {
        console.log('🔌 Клієнт відключився від відео-стріму');
        stopDesktopCapture();
    });

    function startDesktopCapture(websocket) {
        console.log('🎬 Запуск захоплення робочого столу...');
        
        // Використовуємо FFmpeg для захоплення екрану та кодування у WebM
        ffmpegProcess = spawn('ffmpeg', [
            '-f', 'gdigrab',           // Захоплення з Windows GDI
            '-i', 'desktop',           // Захоплення робочого столу
            '-c:v', 'libvpx',          // Кодек VP8 для WebM
            '-b:v', '1M',              // Бітрейт відео 1 Мбіт/с
            '-maxrate', '1M',          // Максимальний бітрейт
            '-bufsize', '2M',          // Буферний розмір
            '-qmin', '10',             // Мінімальна якість
            '-qmax', '42',             // Максимальна якість
            '-g', '30',                // Keyframe кожні 30 кадрів
            '-r', '15',                // 15 FPS
            '-s', '1280x720',          // Розмір відео (можна змінити)
            '-f', 'webm',              // Формат виводу WebM
            '-'                        // Вивід у stdout
        ], {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        ffmpegProcess.stdout.on('data', (chunk) => {
            // Надсилаємо відео-дані клієнту
            if (websocket.readyState === WebSocket.OPEN) {
                websocket.send(chunk);
            }
        });

        ffmpegProcess.stderr.on('data', (data) => {
            console.log('FFmpeg лог:', data.toString());
        });

        ffmpegProcess.on('close', (code) => {
            console.log('🛑 FFmpeg процес завершено з кодом:', code);
        });

        ffmpegProcess.on('error', (error) => {
            console.error('❌ Помилка FFmpeg:', error);
            if (websocket.readyState === WebSocket.OPEN) {
                websocket.send(JSON.stringify({ 
                    error: 'Помилка захоплення екрану. Переконайтеся, що FFmpeg встановлено.' 
                }));
            }
        });
    }

    function stopDesktopCapture() {
        if (ffmpegProcess) {
            console.log('🛑 Зупинка захоплення екрану...');
            ffmpegProcess.kill('SIGTERM');
            ffmpegProcess = null;
        }
    }
});

// Обробка сигналів завершення
process.on('SIGINT', () => {
    console.log('\\n🛑 Завершення роботи сервера...');
    server.close(() => {
        console.log('✅ Сервер зупинено');
        process.exit(0);
    });
});

server.listen(PORT, () => {
    console.log(`🌐 Сервер відео-стрімінгу запущено на порту ${PORT}`);
    console.log(`🔗 Відкрийте http://localhost:${PORT} у браузері`);
    console.log('📹 Live захоплення робочого столу готове!');
    console.log('ℹ️  Переконайтеся, що FFmpeg встановлено та доступний у PATH');
});