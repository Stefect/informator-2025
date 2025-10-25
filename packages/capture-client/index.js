/**
 * Реальний Capture Client з використанням NAPI аддону
 * Захоплює справжній екран через DXGI
 */

const WebSocket = require('ws');
const path = require('path');

// Завантажити NAPI аддон
let nativeCapture;
try {
    nativeCapture = require('./build/Release/screen_capture.node');
    console.log('✅ NAPI аддон завантажено');
} catch (error) {
    console.error('❌ Не вдалося завантажити NAPI аддон:', error.message);
    console.log('💡 Запустіть: npm run build:native');
    process.exit(1);
}

const SERVER_URL = process.env.SERVER_URL || 'ws://localhost:3001';
let ws = null;
let captureInterval = null;
let frameNumber = 0;
let isInitialized = false;

console.log('🎥 Real Capture Client (NAPI)');
console.log(`🔌 Підключення до ${SERVER_URL}...`);

// Спочатку ініціалізуємо NAPI аддон
function initializeCapture() {
    try {
        console.log('🚀 Ініціалізація захоплення екрану (БЕЗ енкодера)...');
        
        const result = nativeCapture.initialize({
            width: 1280,
            height: 720,
            fps: 30, // Збільшено до 30 FPS
            bitrate: 0, // Не використовувати енкодер
            useHardware: false
        });

        if (result.success) {
            console.log(`✅ Захоплення ініціалізовано: ${result.width}x${result.height} @ 30 FPS`);
            isInitialized = true;
            return true;
        } else {
            console.error('❌ Помилка ініціалізації:', result.error);
            console.log('⚠️ Продовжуємо з тестовими даними...');
            return false;
        }
    } catch (error) {
        console.error('❌ Виняток при ініціалізації:', error.message);
        return false;
    }
}

// Підключення до WebSocket
ws = new WebSocket(SERVER_URL);

ws.on('open', () => {
    console.log('✅ WebSocket підключено');
    
    // Відправити ідентифікацію як capture_client
    const identification = {
        type: 'identification',
        clientType: 'capture_client',
        version: '2.0.0',
        platform: process.platform,
        hostname: require('os').hostname()
    };
    
    ws.send(JSON.stringify(identification));
    console.log('📤 Ідентифікацію відправлено (capture_client)');
});

ws.on('message', (data) => {
    try {
        const message = JSON.parse(data.toString());
        console.log(`📥 Отримано повідомлення: ${message.type}`);
        
        switch (message.type) {
            case 'welcome':
                console.log(`👋 Вітаємо! Client ID: ${message.clientId}`);
                break;
                
            case 'stream_created':
                console.log(`📹 Потік створено: ${message.streamId}`);
                console.log('▶️ Автоматичний запуск захоплення через 1 секунду...');
                
                // Ініціалізувати та почати захоплення
                setTimeout(() => {
                    initializeCapture();
                    startCapture();
                }, 1000);
                break;
                
            case 'command':
                handleCommand(message.command);
                break;
        }
    } catch (error) {
        // Не текстове повідомлення
    }
});

ws.on('close', () => {
    console.log('⚠️ WebSocket відключено');
    stopCapture();
    process.exit(0);
});

ws.on('error', (error) => {
    console.error('❌ WebSocket помилка:', error.message);
    process.exit(1);
});

function handleCommand(command) {
    console.log(`📨 Отримано команду: ${command.type}`);
    
    switch (command.type) {
        case 'start_capture':
            console.log('▶️ Команда: почати захоплення');
            if (!captureInterval) {
                initializeCapture();
                startCapture();
            }
            break;
            
        case 'stop_capture':
            console.log('⏹️ Команда: зупинити захоплення');
            stopCapture();
            break;
    }
}

function startCapture() {
    if (captureInterval) {
        console.log('⚠️ Захоплення вже запущено');
        return;
    }
    
    console.log('▶️ Починаємо захоплення екрану (30 FPS)...');
    frameNumber = 0;
    
    // Захоплювати кадри з частотою 30 FPS
    captureInterval = setInterval(() => {
        captureAndSendFrame();
    }, 33); // ~33ms = 30 FPS
}

function stopCapture() {
    if (captureInterval) {
        clearInterval(captureInterval);
        captureInterval = null;
        console.log('⏹️ Захоплення зупинено');
        
        // Очистити NAPI ресурси
        try {
            nativeCapture.stopCapture();
        } catch (e) {
            // Ігноруємо помилки при зупинці
        }
    }
}

function captureAndSendFrame() {
    frameNumber++;
    
    try {
        // Спробувати захопити кадр через NAPI
        const result = nativeCapture.captureFrame();
        
        if (result.success && result.data) {
            // Є дані (закодовані або RAW)
            const isEncoded = result.encoded || false;
            sendFrame(result.data, result.size, isEncoded);
        } else {
            // Помилка захоплення або немає даних - відправляємо тестові дані
            if (result.error && result.error !== 'NO_NEW_FRAME') {
                if (frameNumber % 50 === 0) {
                    console.log(`⚠️ ${result.error}`);
                }
            }
            sendTestFrame();
        }
    } catch (error) {
        console.error('❌ Помилка при захопленні:', error.message);
        sendTestFrame();
    }
}

function sendFrame(frameData, size, isEncoded) {
    const width = 1280; // Відповідає реальному розміру
    const height = 720;
    
    // Метадані кадру
    const metadata = {
        type: 'frame_metadata',
        width: width,
        height: height,
        timestamp: Date.now(),
        frameNumber: frameNumber,
        size: size,
        encoded: isEncoded,
        codec: isEncoded ? 'h264' : 'bgra'
    };
    
    // Відправити метадані
    ws.send(JSON.stringify(metadata));
    
    // Відправити бінарні дані
    ws.send(frameData);
    
    if (frameNumber % 25 === 0) {
        console.log(`📤 Кадр #${frameNumber} (${isEncoded ? 'H.264' : 'BGRA RAW'}, ${(size / 1024).toFixed(1)} KB)`);
    }
}

function sendTestFrame() {
    const width = 1920;
    const height = 1080;
    
    // Метадані кадру
    const metadata = {
        type: 'frame_metadata',
        width: width,
        height: height,
        timestamp: Date.now(),
        frameNumber: frameNumber,
        size: 50000,
        encoded: false,
        codec: 'test'
    };
    
    // Відправити метадані
    ws.send(JSON.stringify(metadata));
    
    // Створити тестовий градієнт
    const frameData = Buffer.alloc(50000);
    const colorOffset = (frameNumber * 10) % 255;
    for (let i = 0; i < frameData.length; i++) {
        frameData[i] = (i + colorOffset) % 256;
    }
    
    // Відправити бінарні дані
    ws.send(frameData);
    
    if (frameNumber % 50 === 0) {
        console.log(`📤 TEST кадр #${frameNumber} (50 KB)`);
    }
}

// Обробка Ctrl+C
process.on('SIGINT', () => {
    console.log('\n⚠️ Отримано SIGINT');
    console.log('👋 Завершення роботи...');
    stopCapture();
    if (ws) {
        ws.close();
    }
    setTimeout(() => process.exit(0), 500);
});

console.log('\n💡 Підказка:');
console.log('   Після підключення клієнт автоматично почне захоплення екрану');
console.log('   Якщо NAPI працює - отримаєте справжній екран');
console.log('   Якщо ні - отримаєте тестовий градієнт');
console.log('   Ctrl+C для зупинки\n');
