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

console.log('🚀 Запуск сервера з реальним захопленням екрану...');

// Налаштування модуля захоплення
screenCapture.setTargetFPS(5);
screenCapture.setActiveClients(true);

// Статичні файли
app.use(express.static(path.join(__dirname, 'public')));

// Головна сторінка
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="uk">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Informator - Реальне захоплення екрану</title>
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
                background: rgba(0,0,0,0.2);
                padding: 20px;
                border-radius: 10px;
                margin: 20px 0;
                backdrop-filter: blur(10px);
            }
            img {
                max-width: 100%;
                height: auto;
                border-radius: 5px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            }
            .info {
                background: rgba(255,255,255,0.1);
                padding: 15px;
                border-radius: 10px;
                margin: 10px 0;
                backdrop-filter: blur(10px);
            }
            .success { color: #4CAF50; font-weight: bold; }
            .error { color: #f44336; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🖥️ Informator - Реальне захоплення екрану</h1>
            <div class="status" id="status">🔄 Підключення до сервера...</div>
            <div class="info" id="info"></div>
            <div class="video-container">
                <img id="screenImage" alt="Захоплення екрану" style="display: none;" />
                <div id="placeholder">🖼️ Очікування зображення екрану...</div>
            </div>
        </div>

        <script>
            const statusEl = document.getElementById('status');
            const infoEl = document.getElementById('info');
            const imageEl = document.getElementById('screenImage');
            const placeholderEl = document.getElementById('placeholder');

            let frameCount = 0;
            let startTime = Date.now();

            const ws = new WebSocket('ws://localhost:3001');

            ws.onopen = function() {
                statusEl.innerHTML = '<span class="success">✅ З\\'єднання встановлено</span>';
                console.log('Підключено до WebSocket сервера');
            };

            ws.onmessage = function(event) {
                if (event.data instanceof Blob) {
                    frameCount++;
                    const fps = (frameCount / ((Date.now() - startTime) / 1000)).toFixed(1);
                    
                    const url = URL.createObjectURL(event.data);
                    imageEl.src = url;
                    imageEl.style.display = 'block';
                    placeholderEl.style.display = 'none';
                    
                    // Звільняємо пам'ять від попереднього URL
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                    
                    infoEl.innerHTML = \`
                        📊 Кадр #\${frameCount} | 
                        🎯 FPS: \${fps} | 
                        📏 Розмір: \${(event.data.size / 1024).toFixed(1)} KB
                    \`;
                }
            };

            ws.onclose = function() {
                statusEl.innerHTML = '<span class="error">❌ З\\'єднання розірвано</span>';
                console.log('WebSocket з\\'єднання закрито');
            };

            ws.onerror = function(error) {
                statusEl.innerHTML = '<span class="error">❌ Помилка з\\'єднання</span>';
                console.error('WebSocket помилка:', error);
            };
        </script>
    </body>
    </html>
    `);
});

// WebSocket з'єднання
wss.on('connection', (ws) => {
    console.log('🔗 Новий клієнт підключився');
    
    // Тестове захоплення для перевірки
    try {
        const testCapture = screenCapture.capture();
        if (testCapture) {
            console.log('✅ Тестове захоплення успішне, розмір:', testCapture.length, 'байт');
        } else {
            console.log('⚠️  Тестове захоплення повернуло null');
        }
        
        const screenSize = screenCapture.getScreenSize();
        console.log('📏 Розмір екрану:', screenSize.width + 'x' + screenSize.height);
    } catch (error) {
        console.error('❌ Помилка при тестовому захопленні:', error);
    }

    // Регулярне захоплення екрану
    let frameCounter = 0;
    const captureInterval = setInterval(() => {
        try {
            const frameData = screenCapture.capture();
            if (frameData && frameData.length > 0) {
                frameCounter++;
                if (frameCounter % 5 === 0) { // Логуємо кожен 5-й кадр
                    console.log(`📸 Надіслано кадр #${frameCounter}, розмір: ${(frameData.length / 1024).toFixed(1)} KB`);
                }
                // Перевіряємо стан WebSocket перед надсиланням
                if (ws.readyState === ws.OPEN) {
                    ws.send(frameData);
                } else {
                    console.log('⚠️ WebSocket не готовий, стан:', ws.readyState);
                }
            } else {
                console.log('⚠️ Захоплення повернуло пусті дані');
            }
        } catch (error) {
            console.error('❌ Помилка при захопленні кадру:', error);
            clearInterval(captureInterval);
        }
    }, 1000); // 1 FPS - менше навантаження

    ws.on('close', (code, reason) => {
        console.log(`🔌 Клієнт відключився. Код: ${code}, Причина: ${reason}`);
        clearInterval(captureInterval);
    });

    ws.on('error', (error) => {
        console.error('❌ WebSocket помилка:', error.message);
        clearInterval(captureInterval);
    });

    ws.on('message', (message) => {
        console.log('📩 Повідомлення від клієнта:', message.toString());
    });
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
    console.log(`🌐 Сервер запущено на порту ${PORT}`);
    console.log(`🔗 Відкрийте http://localhost:${PORT} у браузері`);
    console.log('📹 Реальне захоплення екрану активовано!');
});