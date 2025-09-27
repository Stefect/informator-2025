'use strict';

const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

// Надсилаємо стеки помилок у консоль
Error.stackTraceLimit = 30;

// Порт, на якому буде працювати сервер
const PORT = process.env.PORT || 3000;

// Конфігурація захоплення екрану
const captureConfig = {
    interval: 200, // мс між кадрами (5 FPS максимум)
    quality: 75,   // якість JPEG (1-100)
    scale: 1.0,    // масштаб зображення (1.0 = 100%)
    fps: 5
};

// Глобальні змінні
let screenCaptureModule = null;
let isCapturing = false;
let captureInterval = null;
let activeCapture = false;
let wss = null;

// Типи клієнтів
const CLIENT_TYPES = {
    VIEWER: 'viewer',   // Клієнт, який переглядає екран
    CAPTURE: 'capture'  // Клієнт, який надсилає відео з екрану
};

// Список клієнтів
const clients = {
    viewers: new Map(),   // Клієнти-глядачі
    capturers: new Map()  // Клієнти, які надсилають зображення
};

// Метрики сервера
const metrics = {
    framesReceived: 0,
    framesSent: 0,
    startTime: Date.now(),
    currentFPS: 0,
    lastFrameTime: Date.now(),
    bytesReceived: 0,
    bytesSent: 0
};

// Ініціалізація модуля захоплення екрану
function initializeCapture() {
    try {
        console.log('Початок ініціалізації модуля захоплення...');
        console.log('Статус screenCaptureModule:', screenCaptureModule ? 'завантажено' : 'не завантажено');
        console.log('Статус clients:', clients ? 'існує' : 'не існує');
        console.log('Статус wss:', wss ? 'створено' : 'не створено');
        
        // Спробуємо завантажити модуль з різних локацій
        const modulePaths = [
            './build/Release/gdi_screen_capture.node',
            './gdi_screen_capture.node',
            './build/Release/screencapture.node',
            './screencapture.node'
        ];

        let loadedModule = null;
        let loadedPath = "";

        for (const path of modulePaths) {
            try {
                console.log(`Спроба завантаження модуля з: ${path}`);
                loadedModule = require(path);
                loadedPath = path;
                console.log(`GDI модуль захоплення екрану успішно завантажено з ${path}`);
                
                // Перевіряємо доступні методи і властивості модуля
                console.log('Тип модуля:', typeof loadedModule);
                console.log('Доступні методи та властивості:', Object.keys(loadedModule).join(', '));
                
                // Детальна інформація про кожен метод
                for (const methodName of Object.keys(loadedModule)) {
                    console.log(`Метод/властивість "${methodName}", тип: ${typeof loadedModule[methodName]}`);
                }
                
                // Ініціалізуємо модуль - встановлюємо параметри
                if (typeof loadedModule.setQuality === 'function') {
                    console.log(`Встановлюємо якість зображення: ${captureConfig.quality}`);
                    loadedModule.setQuality(captureConfig.quality);
                }
                
                if (typeof loadedModule.setResolutionScale === 'function') {
                    console.log(`Встановлюємо масштаб зображення: ${captureConfig.scale}`);
                    loadedModule.setResolutionScale(captureConfig.scale);
                }
                
                if (typeof loadedModule.setTargetFPS === 'function') {
                    console.log(`Встановлюємо цільовий FPS: ${captureConfig.fps}`);
                    loadedModule.setTargetFPS(captureConfig.fps);
                }
                
                if (typeof loadedModule.setActiveClients === 'function') {
                    console.log('Встановлюємо активних клієнтів: 1');
                    loadedModule.setActiveClients(1);
                }
                
                // Тестуємо методи, які можуть бути доступні
                testCaptureMethod(loadedModule);
                
                break;
            } catch (err) {
                console.log(`Не вдалося завантажити модуль з ${path}: ${err.message}`);
                console.error('Стек помилки:', err.stack);
            }
        }

        if (!loadedModule) {
            console.error('Не вдалося завантажити GDI модуль захоплення екрану з жодного шляху');
            
            // Створюємо заглушку для тестування без нативного модуля
            console.log('Створення заглушки для тестування...');
            loadedModule = {
                initialize: () => true,
                captureScreen: (quality, scale) => {
                    console.log('Використовується заглушка captureScreen()');
                    // Створюємо мінімальний JPEG буфер для тестування
                    return createTestFrame();
                },
                capture: () => {
                    console.log('Використовується заглушка capture()');
                    return createTestFrame();
                },
                cleanup: () => true
            };
            loadedPath = "заглушка модуля";
        }

        screenCaptureModule = loadedModule;
        console.log(`Модуль захоплення екрану ініціалізовано з ${loadedPath}`);
        return true;
    } catch (error) {
        console.error('Помилка ініціалізації захоплення екрану:', error);
        console.error('Стек помилки:', error.stack);
        return false;
    }
}

// Тестування методів захоплення
function testCaptureMethod(module) {
    try {
        console.log('------ Тестування методів захоплення ------');
        
        // Тест captureScreen
        if (typeof module.captureScreen === 'function') {
            console.log('Тестування методу captureScreen...');
            try {
                const frame = module.captureScreen(80, 1.0); // quality=80, scale=1.0
                console.log(`captureScreen повернув результат типу: ${typeof frame}`);
                console.log(`Розмір кадру: ${frame ? frame.length : 0} байт`);
                
                if (frame && frame.length > 0) {
                    console.log('Метод captureScreen працює коректно і повертає кадр');
                } else {
                    console.log('Метод captureScreen повернув порожній результат');
                }
            } catch (err) {
                console.error('Помилка при виклику captureScreen():', err);
                console.error('Стек помилки:', err.stack);
            }
        }
        
        // Тест capture
        if (typeof module.capture === 'function') {
            console.log('Тестування методу capture...');
            try {
                const frame = module.capture();
                console.log(`capture повернув результат типу: ${typeof frame}`);
                console.log(`Розмір кадру: ${frame ? frame.length : 0} байт`);
                
                if (frame && frame.length > 0) {
                    console.log('Метод capture працює коректно і повертає кадр');
                } else {
                    console.log('Метод capture повернув порожній результат');
                }
            } catch (err) {
                console.error('Помилка при виклику capture():', err);
                console.error('Стек помилки:', err.stack);
            }
        }
        
        // Тест init або initialize, якщо вони існують
        if (typeof module.initialize === 'function') {
            console.log('Тестування методу initialize...');
            try {
                const result = module.initialize();
                console.log(`initialize повернув: ${result}`);
            } catch (err) {
                console.error('Помилка при виклику initialize:', err);
                console.error('Стек помилки:', err.stack);
            }
        }
        
        if (typeof module.init === 'function') {
            console.log('Тестування методу init...');
            try {
                const result = module.init();
                console.log(`init повернув: ${result}`);
            } catch (err) {
                console.error('Помилка при виклику init:', err);
                console.error('Стек помилки:', err.stack);
            }
        }
        
        console.log('------ Тестування завершено ------');
    } catch (err) {
        console.error('Помилка при тестуванні методів модуля:', err);
        console.error('Стек помилки:', err.stack);
    }
}

// Захоплення кадру екрану
function captureFrame() {
    // Перевіряємо, чи активне захоплення
    if (!isCapturing) {
        console.log('Захоплення не активне, кадр не буде захоплено');
        return null;
    }

    try {
        console.log('Спроба захоплення кадру...');
        
        // Перевіряємо наявність методу captureScreen
        if (screenCaptureModule && typeof screenCaptureModule.captureScreen === 'function') {
            try {
                console.log('Використовуємо метод captureScreen()');
                
                // Захоплюємо кадр з екрану
                const frameBuffer = screenCaptureModule.captureScreen(
                    captureConfig.quality, 
                    captureConfig.scale
                );
                
                // Перевіряємо результат
                if (!frameBuffer) {
                    console.log('captureScreen() повернув null або undefined, створюємо тестовий кадр');
                    return createTestFrame();
                }
                
                console.log(`Кадр захоплено успішно, розмір: ${frameBuffer.length} байт`);
                return frameBuffer;
            } catch (error) {
                console.error('Помилка при виклику captureScreen():', error);
                console.error('Стек помилки:', error.stack);
                return createTestFrame();
            }
        } else if (screenCaptureModule && typeof screenCaptureModule.capture === 'function') {
            try {
                console.log('Використовуємо метод capture()');
                
                // Оновлюємо параметри захоплення
                if (typeof screenCaptureModule.setQuality === 'function') {
                    screenCaptureModule.setQuality(captureConfig.quality);
                }
                
                if (typeof screenCaptureModule.setResolutionScale === 'function') {
                    screenCaptureModule.setResolutionScale(captureConfig.scale);
                }
                
                // Отримуємо розмір екрану, якщо доступно
                if (typeof screenCaptureModule.getScreenSize === 'function') {
                    try {
                        const screenSize = screenCaptureModule.getScreenSize();
                        if (screenSize) {
                            console.log(`Розмір екрану: ${screenSize.width}x${screenSize.height}`);
                        }
                    } catch (err) {
                        console.error('Помилка при отриманні розміру екрану:', err);
                        console.error('Стек помилки:', err.stack);
                    }
                }
                
                // Захоплюємо кадр
                console.log('Викликаємо функцію capture()...');
                const frameBuffer = screenCaptureModule.capture();
                
                // Перевіряємо результат
                if (!frameBuffer) {
                    console.log('capture() повернув null або undefined, створюємо тестовий кадр');
                    return createTestFrame();
                }
                
                console.log(`Кадр захоплено успішно, розмір: ${frameBuffer.length} байт`);
                return frameBuffer;
            } catch (error) {
                console.error('Помилка при виклику capture():', error);
                console.error('Стек помилки:', error.stack);
                return createTestFrame();
            }
        } else {
            console.error('Методи захоплення екрану не доступні');
            return createTestFrame();
        }
    } catch (error) {
        console.error('Критична помилка при захопленні кадру:', error);
        console.error('Стек помилки:', error.stack);
        return createTestFrame();
    }
}

// Створення тестового кадру
function createTestFrame() {
    console.log('Генерація тестового кадру замість реального зображення');
    
    // Створюємо кольоровий квадрат розміром 320x240
    const width = 320;
    const height = 240;
    const buffer = Buffer.alloc(width * height * 3); // RGB по 3 байти на піксель
    
    // Заповнюємо кольором
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 3;
            
            // Червоний градієнт
            buffer[i] = Math.floor(255 * x / width);
            
            // Зелений градієнт
            buffer[i + 1] = Math.floor(255 * y / height);
            
            // Синій градієнт
            buffer[i + 2] = 128;
        }
    }
    
    // Створюємо JPEG із буфера RGB
    try {
        // Повертаємо простий JPEG з мінімальною розміткою
        return Buffer.from([
            0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 
            0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43, 
            0x00, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 
            0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 
            0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 
            0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 
            0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 
            0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 
            0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01, 0x00, 
            0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01, 0x00, 
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 
            0x00, 0x00, 0x00, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 
            0x00, 0xD2, 0xCF, 0x20, 0xFF, 0xD9
        ]);
    } catch (error) {
        console.error('Помилка при створенні тестового кадру:', error);
        
        // Повертаємо мінімальний валідний JPEG
        return Buffer.from([
            0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 
            0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43, 
            0x00, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 
            0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 
            0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 
            0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 
            0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 
            0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 
            0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01, 0x00, 
            0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01, 0x00, 
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 
            0x00, 0x00, 0x00, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 
            0x00, 0xD2, 0xCF, 0x20, 0xFF, 0xD9
        ]);
    }
}

// Ініціалізуємо модуль захоплення на старті
initializeCapture();

// Ініціалізація Express додатку
const app = express();
const server = http.createServer(app);

// Перевіряємо наявність обробників необроблених помилок
if (process.listenerCount('uncaughtException') === 0) {
    console.log('Додаємо обробники необроблених помилок');
    
    // Обробники необроблених помилок та відхилених обіцянок
    process.on('uncaughtException', (err) => {
        console.error('Необроблена помилка:', err);
        console.error('Стек помилки:', err.stack);
    });

    process.on('unhandledRejection', (reason, promise) => {
        console.error('Необроблена відхилена обіцянка:', reason);
        if (reason && reason.stack) {
            console.error('Стек помилки:', reason.stack);
        }
    });
}

// Запобігання закриттю програми при помилці
process.on('exit', (code) => {
    console.log(`Процес завершується з кодом: ${code}`);
});

// Перехоплюємо завершення роботи
process.on('SIGINT', () => {
    console.log('Отримано сигнал SIGINT, завершення роботи...');
    if (wss) {
        console.log('Закриття WebSocket сервера...');
        try {
            wss.close(() => {
                console.log('WebSocket сервер закрито');
                process.exit(0);
            });
        } catch (err) {
            console.error('Помилка закриття WebSocket сервера:', err);
            process.exit(1);
        }
    } else {
        process.exit(0);
    }
});

// Статичні файли
app.use(express.static(path.join(__dirname, '..')));

// Перевіряємо директорію
try {
    const staticPath = path.join(__dirname, '..');
    console.log(`Перевіряємо директорію: ${staticPath}`);
    const files = fs.readdirSync(staticPath);
    console.log(`Знайдено файлів: ${files.length}`);
    console.log(`Файли: ${files.join(', ')}`);
} catch (err) {
    console.error('Помилка при читанні директорії:', err);
}

// Маршрут головної сторінки
app.get('/', (req, res) => {
    try {
        const indexPath = path.join(__dirname, '..', 'index.html');
        console.log(`Запит на головну сторінку, шлях: ${indexPath}`);
        
        if (fs.existsSync(indexPath)) {
            console.log('Файл index.html існує, відправляємо');
            res.sendFile(indexPath);
        } else {
            console.error('Файл index.html не знайдено');
            res.status(404).send('File not found');
        }
    } catch (err) {
        console.error('Помилка при обробці запиту /', err);
        res.status(500).send('Server Error');
    }
});

// Запуск сервера
try {
    console.log('Запуск HTTP сервера...');
    console.log('Порт:', PORT);
    console.log('Адреса:', 'localhost');
    console.log('Статус screenCaptureModule:', screenCaptureModule ? 'завантажено' : 'не завантажено');
    console.log('Статус clients:', clients ? 'існує' : 'не існує');
    
    // Перевіряємо, чи порт вже використовується
    const net = require('net');
    const tester = net.createServer()
    .once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`Порт ${PORT} вже використовується!`);
        } else {
            console.error('Помилка при перевірці порту:', err);
        }
        console.log('Спробуємо продовжити...');
    })
    .once('listening', () => {
        tester.close();
    })
    .listen(PORT);
    
    server.listen(PORT, 'localhost', () => {
        console.log(`Сервер запущено на порту ${PORT}`);
        console.log(`Веб-інтерфейс доступний за адресою: http://localhost:${PORT}`);
        
        try {
            // Ініціалізуємо сокет сервер
            console.log('Ініціалізація WebSocket сервера...');
            wss = new WebSocket.Server({ server });
            console.log('WebSocket сервер створено успішно');
            
            // Обробка підключення WebSocket клієнта
            wss.on('connection', (ws, req) => {
                try {
                    console.log('WebSocket підключення:', ws);
                    console.log('Запит:', req);
                    
                    const clientIp = req.socket.remoteAddress;
                    console.log(`Нове підключення від ${clientIp}`);
                    
                    if (!uuidv4) {
                        console.error('ПОМИЛКА: uuidv4 не визначений!');
                        if (uuid && uuid.v4) {
                            console.log('Встановлення uuid.v4 як uuidv4');
                            global.uuidv4 = uuid.v4;
                        } else {
                            console.error('Не вдалося знайти функцію uuid.v4!');
                            return;
                        }
                    }
                    
                    // Унікальний ідентифікатор клієнта
                    const clientId = uuidv4();
                    console.log(`Використовуємо uuidv4: ${typeof uuidv4}`);
                    
                    // За замовчуванням вважаємо клієнта глядачем
                    let clientType = CLIENT_TYPES.VIEWER;
                    let clientInfo = { id: clientId, ip: clientIp, type: clientType, connectedAt: new Date() };
                    
                    // Перевіряємо, що clients.viewers існує
                    if (!clients || !clients.viewers) {
                        console.error('КРИТИЧНА ПОМИЛКА: clients.viewers не визначений!');
                        console.log('Структура clients:', clients);
                        clients = {
                            viewers: new Map(),
                            capturers: new Map()
                        };
                    }
                    
                    // Додаємо нового глядача до колекції
                    clients.viewers.set(clientId, { ws, info: clientInfo });
                    
                    console.log(`Підключено нового глядача (${clientId}), всього глядачів: ${clients.viewers.size}`);
                    
                    // Якщо це перший глядач, запускаємо захоплення екрану
                    if (clients.viewers.size === 1 && !isCapturing) {
                        startCapture();
                    }
                    
                    // Повідомляємо клієнти захоплення про кількість глядачів
                    broadcastViewerCount();
                
                    // Обробка повідомлень від клієнта
                    ws.on('message', (message) => {
                        try {
                            // Якщо це бінарне повідомлення (кадр відео)
                            if (Buffer.isBuffer(message)) {
                                handleVideoFrame(clientId, message);
                                return;
                            }
                            
                            // Якщо це JSON повідомлення
                            const data = JSON.parse(message.toString());
                            console.log(`Отримано повідомлення від клієнта ${clientId}:`, data.type);
                            
                            // Обробка різних типів повідомлень
                            if (data.type === 'identify') {
                                handleClientIdentification(clientId, data, ws);
                            }
                            else if (data.type === 'config') {
                                // Оновлення конфігурації захоплення екрану
                                if (data.captureConfig) {
                                    Object.assign(captureConfig, data.captureConfig);
                                    console.log('Оновлено конфігурацію захоплення:', captureConfig);
                                    
                                    // Якщо змінюється FPS, перезапускаємо захоплення
                                    if (isCapturing) {
                                        stopCapture();
                                        startCapture();
                                    }
                                }
                            }
                        } catch (err) {
                            console.error(`Помилка обробки повідомлення від клієнта ${clientId}:`, err);
                            console.error('Стек помилки:', err.stack);
                        }
                    });
                    
                    // Обробка закриття з'єднання
                    ws.on('close', () => {
                        console.log(`Клієнт ${clientId} від'єднався`);
                        
                        // Видаляємо клієнта з відповідної колекції
                        if (clientType === CLIENT_TYPES.VIEWER) {
                            clients.viewers.delete(clientId);
                            console.log(`Глядач від'єднався, залишилося глядачів: ${clients.viewers.size}`);
                            
                            // Якщо не залишилося глядачів, зупиняємо захоплення екрану
                            if (clients.viewers.size === 0 && isCapturing) {
                                console.log('Немає активних глядачів, зупиняємо захоплення екрану');
                                stopCapture();
                            }
                            
                            // Повідомляємо клієнти захоплення про оновлену кількість глядачів
                            broadcastViewerCount();
                        } else if (clientType === CLIENT_TYPES.CAPTURE) {
                            clients.capturers.delete(clientId);
                            console.log(`Клієнт захоплення від'єднався, залишилося клієнтів захоплення: ${clients.capturers.size}`);
                        }
                    });
                    
                    // Обробка помилок
                    ws.on('error', (err) => {
                        console.error(`Помилка WebSocket з'єднання для клієнта ${clientId}:`, err);
                        console.error('Стек помилки:', err.stack);
                    });
                } catch (error) {
                    console.error('Помилка при обробці нового WebSocket підключення:', error);
                    console.error('Стек помилки:', error.stack);
                }
            });
            
            console.log('WebSocket сервер готовий до прийому з\'єднань');
        } catch (wsError) {
            console.error('Помилка при ініціалізації WebSocket сервера:', wsError);
            console.error('Стек помилки:', wsError.stack);
        }
    });
} catch (serverError) {
    console.error('Помилка при запуску HTTP сервера:', serverError);
    console.error('Стек помилки:', serverError.stack);
}

// Обробники необроблених помилок та відхилених обіцянок
process.on('uncaughtException', (err) => {
    console.error('Необроблена помилка:', err);
    console.error('Стек помилки:', err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Необроблена відхилена обіцянка:', reason);
    if (reason && reason.stack) {
        console.error('Стек помилки:', reason.stack);
    }
});

// Перевіряємо структуру clients перед використанням
console.log("Перевірка структури clients:");
console.log("clients:", typeof clients, clients ? Object.keys(clients) : 'undefined');
console.log("clients.viewers:", clients.viewers instanceof Map);
console.log("clients.capturers:", clients.capturers instanceof Map);

// Ініціалізуємо об'єкти для клієнтів, якщо вони не існують
if (!clients) {
    console.log("Ініціалізація об'єкта clients");
    clients = {
        viewers: new Map(),
        capturers: new Map()
    };
}

// Запуск захоплення екрану
function startCapture() {
    if (isCapturing) {
        console.log('Захоплення екрану вже запущено');
        return;
    }
    
    console.log('Запуск захоплення екрану...');
    
    try {
        // Перевіряємо наявність модуля захоплення екрану
        if (!screenCaptureModule) {
            console.log('Модуль захоплення екрану не завантажено. Намагаємося завантажити...');
            if (!initializeCapture()) {
                console.error('Не вдалося ініціалізувати модуль захоплення екрану');
                return;
            }
        }
        
        isCapturing = true;
        
        // Запускаємо інтервал захоплення екрану
        const interval = Math.max(1000 / captureConfig.fps, 100); // Мінімум 100мс
        console.log(`Запуск захоплення з інтервалом ${interval}мс (${captureConfig.fps} FPS)`);
        
        captureInterval = setInterval(() => {
            try {
                // Якщо немає глядачів, не захоплюємо екран
                if (clients.viewers.size === 0) {
                    console.log('Немає активних глядачів, пауза захоплення екрану');
                    return;
                }
                
                // Перед кожним захопленням оновлюємо параметри модуля
                if (screenCaptureModule) {
                    try {
                        // Встановлюємо параметри перед захопленням
                        if (typeof screenCaptureModule.setActiveClients === 'function') {
                            let activeViewers = clients.viewers.size > 0 ? clients.viewers.size : 1;
                            screenCaptureModule.setActiveClients(activeViewers);
                        }
                        
                        // Перевірка наявності та доступності функцій перед викликом
                        if (typeof screenCaptureModule.setQuality === 'function' && captureConfig && 'quality' in captureConfig) {
                            screenCaptureModule.setQuality(captureConfig.quality);
                        }
                        
                        if (typeof screenCaptureModule.setResolutionScale === 'function' && captureConfig && 'scale' in captureConfig) {
                            screenCaptureModule.setResolutionScale(captureConfig.scale);
                        }
                        
                        if (typeof screenCaptureModule.setTargetFPS === 'function' && captureConfig && 'fps' in captureConfig) {
                            screenCaptureModule.setTargetFPS(captureConfig.fps);
                        }
                    } catch (paramError) {
                        console.error('Помилка при встановленні параметрів захоплення:', paramError);
                        console.error('Стек помилки:', paramError.stack);
                    }
                }
                
                captureFrame();
            } catch (captureError) {
                console.error('Помилка при захопленні кадру:', captureError);
                console.error('Стек помилки:', captureError.stack);
            }
        }, interval);
        
        console.log('Захоплення екрану запущено');
    } catch (err) {
        console.error('Помилка при запуску захоплення екрану:', err);
        console.error('Стек помилки:', err.stack);
        isCapturing = false;
    }
}

// Зупинка захоплення екрану
function stopCapture() {
    if (!isCapturing) {
        console.log('Захоплення екрану вже зупинено');
        return;
    }
    
    console.log('Зупинка захоплення екрану...');
    
    if (captureInterval) {
        clearInterval(captureInterval);
        captureInterval = null;
    }
    
    isCapturing = false;
    activeCapture = false;
    
    // Звільнення ресурсів
    if (screenCaptureModule && screenCaptureModule.cleanup) {
        try {
            screenCaptureModule.cleanup();
            console.log('Ресурси захоплення екрану звільнено');
        } catch (error) {
            console.error('Помилка звільнення ресурсів захоплення екрану:', error);
            console.error('Стек помилки:', error.stack);
        }
    }
}

// Обробка ідентифікації клієнта
function handleClientIdentification(clientId, data, ws) {
    console.log(`Клієнт ${clientId} ідентифікувався як ${data.role}`);
    
    // Якщо клієнт ідентифікується як захоплення екрану
    if (data.role === 'screen-capture') {
        // Перенести клієнта з глядачів до клієнтів захоплення
        if (clients.viewers.has(clientId)) {
            clients.viewers.delete(clientId);
        }
        
        // Оновити тип клієнта
        const clientInfo = {
            id: clientId,
            type: CLIENT_TYPES.CAPTURE,
            hostname: data.hostname || 'unknown',
            os: data.os || 'unknown',
            version: data.version || '1.0.0',
            connectedAt: new Date()
        };
        
        // Додати до колекції клієнтів захоплення
        clients.capturers.set(clientId, { ws, info: clientInfo });
        console.log(`Клієнт ${clientId} зареєстрований як клієнт захоплення екрану`);
        
        // Повідомити клієнта про поточну кількість глядачів
        notifyViewerCount(ws);
    }
}

// Обробка кадру відео від клієнта захоплення
function handleVideoFrame(clientId, frameData) {
    // Перевіряємо, чи клієнт з таким ID є в списку клієнтів захоплення
    const client = [...clients.capturers.values()].find(c => c.info.id === clientId);
    
    if (!client) {
        // Якщо глядач відправив бінарні дані, ігноруємо
        console.warn(`Отримано бінарні дані від неавторизованого клієнта ${clientId}`);
        return;
    }
    
    // Оновлюємо метрики
    metrics.framesReceived++;
    metrics.bytesReceived += frameData.length;
    metrics.currentFPS = 1000 / (Date.now() - metrics.lastFrameTime);
    metrics.lastFrameTime = Date.now();
    
    if (metrics.framesReceived % 10 === 0) {
        console.log(`Отримано ${metrics.framesReceived} кадрів, поточний FPS: ${metrics.currentFPS.toFixed(1)}`);
        console.log(`Розмір останнього кадру: ${Math.round(frameData.length / 1024)} KB`);
    }
    
    // Розсилаємо кадр усім глядачам
    broadcastFrameToViewers(frameData);
}

// Розсилання кадру всім глядачам
function broadcastFrameToViewers(frameData) {
    if (clients.viewers.size === 0) {
        return; // Немає глядачів
    }
    
    for (const [clientId, client] of clients.viewers) {
        try {
            if (client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(frameData, { binary: true }, (err) => {
                    if (err) {
                        console.error(`Помилка відправки кадру глядачу ${clientId}:`, err);
                        console.error('Стек помилки:', err.stack);
                    }
                });
                metrics.framesSent++;
                metrics.bytesSent += frameData.length;
            }
        } catch (err) {
            console.error(`Помилка відправки кадру глядачу ${clientId}:`, err);
            console.error('Стек помилки:', err.stack);
        }
    }
}

// Повідомлення клієнтів захоплення про кількість глядачів
function broadcastViewerCount() {
    for (const [clientId, client] of clients.capturers) {
        notifyViewerCount(client.ws);
    }
}

// Повідомлення окремого клієнта про кількість глядачів
function notifyViewerCount(ws) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'viewer-count',
            count: clients.viewers.size
        }));
    }
}

// Обробка завершення роботи
process.on('SIGINT', () => {
    console.log('Завершення роботи сервера...');
    
    // Зупиняємо захоплення екрану
    stopCapture();
    
    // Закриваємо всі WebSocket з'єднання
    wss.clients.forEach((client) => {
        try {
            client.terminate();
        } catch (err) {
            console.error('Помилка закриття з\'єднання:', err);
            console.error('Стек помилки:', err.stack);
        }
    });
    
    console.log('Всі з\'єднання закрито');
    
    // Виводимо статистику сесії
    const sessionStats = {
        framesReceived: metrics.framesReceived,
        framesSent: metrics.framesSent,
        uptime: (Date.now() - metrics.startTime) / 1000,
        endTime: new Date().toISOString()
    };
    console.log('Статистика сесії:', sessionStats);
    
    // Завершуємо процес
    process.exit(0);
});
