const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');

let screenCapture;
try {
    screenCapture = require('./dist/screencapture.node');
    console.log('✅ Модуль захоплення екрану успішно завантажено!');
} catch (error) {
    console.error('❌ Помилка завантаження модуля захоплення екрану:', error.message);
    process.exit(1);
}

const PORT = 3001;
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

console.log('🚀 Запуск сервера live відео-стрімінгу...');

// Налаштування захоплення для відео
screenCapture.setTargetFPS(30); // 30 FPS для дуже плавного відео
screenCapture.setActiveClients(true);

// Статичні файли вимкнені для live відео-стріму

// Головна сторінка з відео-стрімом
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="uk">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Live Desktop Video Stream - Informator</title>
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
            canvas {
                width: 100%;
                max-width: 1000px;
                height: auto;
                border-radius: 10px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                background: #000;
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
            select {
                background: #4CAF50;
                color: white;
                border: none;
                padding: 8px 16px;
                margin: 0 10px;
                border-radius: 20px;
                font-size: 14px;
                cursor: pointer;
            }
            label {
                color: white;
                font-size: 16px;
                margin-right: 10px;
            }
            .success { color: #4CAF50; font-weight: bold; }
            .error { color: #f44336; font-weight: bold; }
            .info {
                background: rgba(255,255,255,0.1);
                padding: 10px;
                border-radius: 10px;
                margin: 10px 0;
                backdrop-filter: blur(10px);
                font-size: 14px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🎥 Live Desktop Stream - Informator</h1>
            <div class="status" id="status">🔄 Підключення...</div>
            <div class="info" id="info">ℹ️ Очікування підключення до сервера...</div>
            
            <div class="video-container">
                <canvas id="videoCanvas" width="1280" height="720"></canvas>
            </div>
            
            <div class="controls">
                <button id="startStream" onclick="startStream()" disabled>▶️ Запустити стрім</button>
                <button id="stopStream" onclick="stopStream()" disabled>⏹️ Зупинити стрім</button>
                <br><br>
                <label for="fpsSelect">🎯 Швидкість кадрів:</label>
                <select id="fpsSelect" onchange="changeFPS()">
                    <option value="15">15 FPS (стандарт)</option>
                    <option value="30" selected>30 FPS (плавно)</option>
                    <option value="60">60 FPS (дуже плавно)</option>
                </select>
            </div>
        </div>

        <script>
            const statusEl = document.getElementById('status');
            const infoEl = document.getElementById('info');
            const canvas = document.getElementById('videoCanvas');
            const ctx = canvas.getContext('2d');
            const startBtn = document.getElementById('startStream');
            const stopBtn = document.getElementById('stopStream');

            let ws = null;
            let isStreaming = false;
            let frameCount = 0;
            let startTime = Date.now();

            function connectWebSocket() {
                ws = new WebSocket('ws://localhost:3001');
                
                ws.onopen = function() {
                    statusEl.innerHTML = '<span class="success">✅ З\\'єднання встановлено</span>';
                    infoEl.innerHTML = '📡 Готовий до запуску live відео-стріму';
                    startBtn.disabled = false;
                };

                ws.onmessage = function(event) {
                    // Обробка текстових повідомлень (підтвердження FPS)
                    if (typeof event.data === 'string' && event.data.startsWith('fps_changed:')) {
                        const newFPS = event.data.split(':')[1];
                        console.log('FPS підтверджено:', newFPS);
                        infoEl.innerHTML = '✅ Швидкість кадрів змінено на ' + newFPS + ' FPS';
                        return;
                    }
                    
                    if (event.data instanceof Blob && isStreaming) {
                        // Конвертуємо Blob у зображення та малюємо на canvas
                        const url = URL.createObjectURL(event.data);
                        const img = new Image();
                        
                        img.onload = function() {
                            // Масштабуємо та малюємо зображення на canvas
                            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                            
                            // Оновлюємо статистику
                            frameCount++;
                            const fps = (frameCount / ((Date.now() - startTime) / 1000)).toFixed(1);
                            const sizeKB = (event.data.size / 1024).toFixed(1);
                            
                            infoEl.innerHTML = \`
                                🎬 Live відео-стрім активний | 
                                📊 Кадр #\${frameCount} | 
                                🎯 FPS: \${fps} | 
                                📏 Розмір кадру: \${sizeKB} KB
                            \`;
                            
                            URL.revokeObjectURL(url);
                        };
                        
                        img.src = url;
                    }
                };

                ws.onclose = function() {
                    statusEl.innerHTML = '<span class="error">❌ З\\'єднання розірвано</span>';
                    infoEl.innerHTML = '🔄 Переподключення через 3 секунди...';
                    startBtn.disabled = true;
                    stopBtn.disabled = true;
                    isStreaming = false;
                    setTimeout(connectWebSocket, 3000);
                };

                ws.onerror = function(error) {
                    statusEl.innerHTML = '<span class="error">❌ Помилка з\\'єднання</span>';
                    console.error('WebSocket помилка:', error);
                };
            }

            function startStream() {
                if (!ws || ws.readyState !== WebSocket.OPEN) {
                    infoEl.innerHTML = '<span class="error">❌ Немає з\\'єднання з сервером</span>';
                    return;
                }

                ws.send('start_video_stream');
                isStreaming = true;
                frameCount = 0;
                startTime = Date.now();
                
                startBtn.disabled = true;
                stopBtn.disabled = false;
                statusEl.innerHTML = '<span class="success">🔴 Live стрім активний</span>';
                infoEl.innerHTML = '🎬 Започаткування відео-стріму з робочого столу...';
            }

            function stopStream() {
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send('stop_video_stream');
                }
                
                isStreaming = false;
                startBtn.disabled = false;
                stopBtn.disabled = true;
                statusEl.innerHTML = '<span class="success">⏸️ Стрім зупинено</span>';
                infoEl.innerHTML = '📡 Готовий до запуску нового стріму';
                
                // Очищуємо canvas
                ctx.fillStyle = '#000';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#fff';
                ctx.font = '24px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('Стрім зупинено', canvas.width/2, canvas.height/2);
            }

            function changeFPS() {
                const fpsSelect = document.getElementById('fpsSelect');
                const selectedFPS = fpsSelect.value;
                
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send('set_fps:' + selectedFPS);
                    infoEl.innerHTML = '🎯 Швидкість кадрів змінено на ' + selectedFPS + ' FPS';
                }
            }

            // Автопідключення при завантаженні
            connectWebSocket();
        </script>
    </body>
    </html>
    `);
});

// WebSocket обробка для відео-стріму
wss.on('connection', (ws) => {
    console.log('🔗 Новий клієнт підключився для live відео-стріму');
    
    let streamInterval = null;
    let isActiveStream = false;
    let currentFPS = 30;
    
    // Тестове захоплення
    try {
        const testCapture = screenCapture.capture();
        if (testCapture) {
            console.log('✅ Тестове захоплення успішне, розмір:', testCapture.length, 'байт');
        }
        
        const screenSize = screenCapture.getScreenSize();
        console.log('📏 Розмір екрану:', screenSize.width + 'x' + screenSize.height);
    } catch (error) {
        console.error('❌ Помилка при тестовому захопленні:', error);
    }

    ws.on('message', (message) => {
        const command = message.toString();
        console.log('📩 Отримано команду:', command);
        
        if (command === 'start_video_stream') {
            startVideoStream();
        } else if (command === 'stop_video_stream') {
            stopVideoStream();
        } else if (command.startsWith('set_fps:')) {
            const fps = parseInt(command.split(':')[1]);
            changeFPSRate(fps);
        }
    });

    ws.on('close', () => {
        console.log('🔌 Клієнт відключився від відео-стріму');
        stopVideoStream();
    });

    ws.on('error', (error) => {
        console.error('❌ WebSocket помилка:', error.message);
        stopVideoStream();
    });

    function startVideoStream() {
        if (isActiveStream) return;
        
        console.log('🎬 Запуск live відео-стріму...');
        isActiveStream = true;
        
        // Захоплюємо кадри з частотою 30 FPS для дуже плавного відео
        streamInterval = setInterval(() => {
            try {
                if (ws.readyState === WebSocket.OPEN) {
                    const frameData = screenCapture.capture();
                    if (frameData && frameData.length > 0) {
                        ws.send(frameData);
                    }
                } else {
                    console.log('⚠️ WebSocket закрито, зупинка стріму');
                    stopVideoStream();
                }
            } catch (error) {
                console.error('❌ Помилка захоплення кадру:', error);
                stopVideoStream();
            }
        }, Math.round(1000 / currentFPS)); // Динамічний FPS
    }

    function stopVideoStream() {
        if (!isActiveStream) return;
        
        console.log('🛑 Зупинка live відео-стріму...');
        isActiveStream = false;
        
        if (streamInterval) {
            clearInterval(streamInterval);
            streamInterval = null;
        }
    }

    function changeFPSRate(fps) {
        currentFPS = fps;
        console.log('🎯 Зміна FPS на:', fps);
        screenCapture.setTargetFPS(fps);
        
        // Надсилаємо підтвердження клієнту
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(`fps_changed:${fps}`);
        }
        
        // Якщо стрім активний, перезапускаємо з новим FPS
        if (isActiveStream) {
            stopVideoStream();
            setTimeout(() => startVideoStream(), 100);
        }
    }
});

// Обробка сигналів завершення
process.on('SIGINT', () => {
    console.log('\\n🛑 Завершення роботи сервера...');
    screenCapture.setActiveClients(false);
    server.close(() => {
        console.log('✅ Сервер зупинено');
        process.exit(0);
    });
});

server.listen(PORT, () => {
    console.log(`🌐 Live відео-стрім сервер запущено на порту ${PORT}`);
    console.log(`🔗 Відкрийте http://localhost:${PORT} у браузері`);
    console.log('🎥 Готовий до live відео-трансляції робочого столу!');
});