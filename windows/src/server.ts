/**
 * Головний серверний модуль для системи захоплення екрану
 * Відповідає за:
 * - захоплення кадрів з екрану
 * - передачу кадрів клієнтам через WebSocket
 * - керування підключеннями клієнтів
 * - надання веб-інтерфейсу для перегляду відеопотоку
 * 
 * @author Informator Team
 * @version 1.2.0
 */

import * as WebSocket from 'ws';      // Бібліотека для роботи з WebSocket
import * as http from 'http';          // Стандартний HTTP модуль Node.js
import express from 'express';         // Веб-фреймворк для створення API та обслуговування статичних файлів
import * as path from 'path';          // Робота з шляхами до файлів
import * as fs from 'fs';              // Робота з файловою системою

/**
 * Інтерфейси для типізації даних
 */

/**
 * Конфігурація захоплення екрану
 * Визначає параметри якості та швидкості захоплення кадрів
 */
interface CaptureConfig {
    /** Інтервал між кадрами у мілісекундах */
    interval: number;
    /** Якість JPEG стиснення (1-100) */
    quality: number;
    /** Масштаб зображення (множник для зміни розміру) */
    scale: number;
    /** Цільова кількість кадрів на секунду */
    fps: number;
}

/**
 * Метрики роботи сервера
 * Використовуються для моніторингу продуктивності та навантаження
 */
interface Metrics {
    /** Кількість отриманих кадрів від модуля захоплення */
    framesReceived: number;
    /** Кількість відправлених кадрів клієнтам */
    framesSent: number;
    /** Час початку роботи сервера */
    startTime: number;
    /** Поточна швидкість кадрів (FPS) */
    currentFPS: number;
    /** Час останнього захопленого кадру */
    lastFrameTime: number;
    /** Об'єм отриманих даних (байт) */
    bytesReceived: number;
    /** Об'єм відправлених даних (байт) */
    bytesSent: number;
    /** Поточний бітрейт в біт/с */
    bitrate: number;
    /** Історія бітрейтів для адаптивного керування */
    bitrateHistory: number[];
    /** Час останньої перевірки бітрейту */
    lastBitrateCheck: number;
}

/**
 * Інформація про клієнта
 * Зберігає дані про підключеного клієнта та його WebSocket з'єднання
 */
interface Client {
    /** WebSocket з'єднання з клієнтом */
    ws: WebSocket;
    /** Тип клієнта (глядач або джерело захоплення) */
    type: string;
    /** Унікальний ідентифікатор клієнта */
    id: string;
}

/**
 * Колекція підключених клієнтів
 * Розділяє клієнтів за типами та зберігає їх у зручних для доступу структурах
 */
interface ClientsCollection {
    /** Клієнти, які переглядають відеопотік */
    viewers: Map<string, Client>;
    /** Клієнти, які надсилають відеопотік (зазвичай один) */
    capturers: Map<string, Client>;
}

/**
 * Глобальні константи та змінні серверу
 */

/** 
 * Порт, на якому буде працювати сервер
 * Може бути встановлений через середовище або використовується 3000 за замовчуванням
 */
const PORT: number = Number(process.env.PORT) || 3000;

/** 
 * Конфігурація захоплення екрану
 * Визначає параметри якості зображення та частоти кадрів
 */
const captureConfig: CaptureConfig = {
    interval: 100,    // мс між кадрами (100 мс = 10 fps)
    quality: 85,     // якість JPEG (1-100) - зменшено для оптимізації трафіку
    scale: 0.9,    // масштаб зображення (0.9 = 90%) - трохи зменшено для оптимізації трафіку
    fps: 10        // цільова кількість кадрів на секунду - оптимізовано відповідно до вимог (мінімум 3 FPS)
};

/**
 * Ліміти для адаптивного контролю трафіку
 */
const trafficLimits = {
    /** Максимальний ліміт трафіку в біт/с (10 Мбіт/с згідно з вимогою) */
    maxBitrate: 10 * 1024 * 1024, // 10 Mbps
    /** Період вимірювання для розрахунку бітрейту (1 секунда) */
    measurementPeriod: 1000,
    /** Проміжок часу для перевірки трафіку (кожні 10 секунд) */
    checkInterval: 10000
};

/** Посилання на нативний модуль захоплення екрану */
let screenCaptureModule: any = null;
/** Прапорець, що вказує, чи активне захоплення екрану зараз */
let isCapturing: boolean = false;
/** Таймер для періодичного захоплення кадрів */
let captureInterval: NodeJS.Timeout | null = null;
/** WebSocket сервер для комунікації з клієнтами */
let wss: WebSocket.Server | null = null;

/** 
 * Константи типів клієнтів для ідентифікації ролей підключень
 */
const CLIENT_TYPES = {
    /** Клієнт, який переглядає екран (отримує відеопотік) */
    VIEWER: 'viewer',   
    /** Клієнт, який надсилає відео з екрану (джерело захоплення) */
    CAPTURE: 'capture'  
};

/** 
 * Список активних клієнтів, розділений за типами
 * Використовуємо Map для швидкого доступу за ідентифікатором
 */
const clients: ClientsCollection = {
    /** Клієнти-глядачі, які отримують відеопотік */
    viewers: new Map<string, Client>(),   
    /** Клієнти, які надсилають відеопотік (зазвичай один) */
    capturers: new Map<string, Client>()  
};

/** 
 * Метрики сервера для моніторингу продуктивності
 * Оновлюються в процесі роботи системи
 */
const metrics: Metrics = {
    framesReceived: 0,       // Лічильник отриманих кадрів
    framesSent: 0,           // Лічильник відправлених кадрів
    startTime: Date.now(),   // Час запуску сервера
    currentFPS: 0,           // Поточний FPS (оновлюється періодично)
    lastFrameTime: Date.now(), // Час останнього кадру
    bytesReceived: 0,        // Кількість отриманих байтів
    bytesSent: 0,            // Кількість відправлених байтів
    bitrate: 0,              // Поточний бітрейт в біт/с
    bitrateHistory: [],      // Історія бітрейтів для адаптивного керування
    lastBitrateCheck: Date.now() // Час останньої перевірки бітрейту
};

/**
 * Створює тестовий кадр з інформацією про стан системи
 * Використовується як запасний варіант, якщо нативний модуль захоплення недоступний
 * 
 * @returns Buffer з JPEG-зображенням або null у випадку помилки
 */
function createTestFrame(): Buffer | null {
    try {
        const { createCanvas } = require('canvas');
        const width: number = 1280;
        const height: number = 720;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        
        // Заповнюємо чорним кольором
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);
        
        // Додаємо текст
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Тестовий кадр', width / 2, height / 2 - 20);
        
        // Додаємо поточний час
        const now = new Date();
        ctx.fillText(now.toLocaleTimeString(), width / 2, height / 2 + 20);
        
        // Додаємо лічильник кадрів
        ctx.fillText(`Кадр #${metrics.framesReceived}`, width / 2, height / 2 + 60);
        
        // Конвертуємо в JPEG
        const buffer = canvas.toBuffer('image/jpeg', { quality: captureConfig.quality / 100 });
        
        return buffer;
    } catch (error) {
        console.error('Помилка створення тестового кадру:', error);
        return null;
    }
}

/**
 * Ініціалізує модуль захоплення екрану
 * Намагається завантажити нативний модуль за різними шляхами
 * та налаштовує параметри захоплення
 * 
 * @returns true якщо ініціалізація успішна, false у випадку помилки
 */
function initializeCapture(): boolean {
    try {
        console.log('Початок ініціалізації модуля захоплення...');
        
        // Спробуємо завантажити модуль з різних локацій
        const modulePaths: string[] = [
            './build/Release/gdi_screen_capture.node',
            './gdi_screen_capture.node',
            './build/Release/screencapture.node',
            './screencapture.node',
            './windows/build/Release/gdi_screen_capture.node',
            './windows/gdi_screen_capture.node',
            './windows/dist/screencapture.node'
        ];

        let loadedModule: any = null;
        let loadedPath: string = "";

        for (const modulePath of modulePaths) {
            try {
                console.log(`Спроба завантаження модуля з: ${modulePath}`);
                const resolvedPath = path.resolve(__dirname, modulePath);
                
                if (fs.existsSync(resolvedPath)) {
                    loadedModule = require(resolvedPath);
                    loadedPath = resolvedPath;
                    console.log(`Модуль знайдено та завантажено з: ${resolvedPath}`);
                    break;
                }
            } catch (err) {
                console.log(`Не вдалося завантажити модуль з: ${modulePath}. ${err}`);
            }
        }

        if (loadedModule === null) {
            console.warn('Не вдалося знайти модуль захоплення екрану. Буде використано тестовий генератор кадрів.');
            screenCaptureModule = null;
            return false;
        }

        screenCaptureModule = loadedModule;
        console.log(`Використовуємо модуль захоплення екрану, завантажений з: ${loadedPath}`);

        // Отримуємо розміри екрану
        const screenSize = screenCaptureModule.getScreenSize();
        console.log(`Розмір екрану: ${screenSize.width}x${screenSize.height}`);

        // Встановлюємо параметри захоплення
        console.log(`Встановлюємо якість зображення: ${captureConfig.quality}`);
        screenCaptureModule.setJpegQuality(captureConfig.quality);

        console.log(`Встановлюємо масштаб зображення: ${captureConfig.scale}`);
        screenCaptureModule.setScale(captureConfig.scale);

        console.log(`Встановлюємо цільовий FPS: ${captureConfig.fps}`);
        screenCaptureModule.setTargetFPS(captureConfig.fps);

        console.log(`Встановлюємо активних клієнтів: ${clients.viewers.size > 0}`);
        screenCaptureModule.setActive(clients.viewers.size > 0);

        console.log('Модуль захоплення екрану успішно ініціалізовано');
        return true;
    } catch (error) {
        console.error('Помилка ініціалізації модуля захоплення екрану:', error);
        screenCaptureModule = null;
        return false;
    }
}

/**
 * Захоплює поточний кадр з екрану через нативний модуль
 * Обробляє помилки та оновлює метрики продуктивності
 * 
 * @returns Buffer із зображенням у форматі JPEG або null у випадку помилки
 */
function captureFrame(): Buffer | null {
    try {
        // Якщо немає модуля захоплення екрану, створюємо тестовий кадр
        if (!screenCaptureModule) {
            const testFrame = createTestFrame();
            
            if (testFrame) {
                metrics.framesReceived++;
                
                const now = Date.now();
                const timeSinceLastFrame = now - metrics.lastFrameTime;
                metrics.currentFPS = 1000 / timeSinceLastFrame;
                metrics.lastFrameTime = now;
                
                // Виводимо статистику кожні 30 кадрів
                if (metrics.framesReceived % 30 === 0) {
                    console.log(`Створено ${metrics.framesReceived} тестових кадрів, поточний FPS: ${metrics.currentFPS.toFixed(1)}`);
                }
                
                return testFrame;
            }
            
            return null;
        }
        
        // Якщо є модуль захоплення екрану, використовуємо його
        if (!isCapturing) {
            return null;
        }
        
        // Захоплюємо кадр
        const frameBuffer = screenCaptureModule.capture();
        
        if (!frameBuffer) {
            console.error('Не вдалося захопити кадр');
            return null;
        }
        
        // Оновлюємо статистику
        metrics.framesReceived++;
        
        const now = Date.now();
        const timeSinceLastFrame = now - metrics.lastFrameTime;
        metrics.currentFPS = 1000 / timeSinceLastFrame;
        metrics.lastFrameTime = now;
        
        // Виводимо статистику кожні 30 кадрів
        if (metrics.framesReceived % 30 === 0) {
            console.log(`Захоплено ${metrics.framesReceived} кадрів, поточний FPS: ${metrics.currentFPS.toFixed(1)}`);
        }
        
        return frameBuffer;
    } catch (error) {
        console.error('Помилка захоплення кадру:', error);
        return null;
    }
}

/**
 * Запускає процес періодичного захоплення екрану
 * Налаштовує інтервал для захоплення кадрів з заданою частотою
 */
function startCapture(): void {
    if (isCapturing) {
        console.log('Захоплення екрану вже запущено');
        return;
    }
    
    console.log('Запуск захоплення екрану...');
    
    // Ініціалізуємо модуль захоплення екрану, якщо він ще не ініціалізований
    if (!screenCaptureModule) {
        initializeCapture();
    }
    
    isCapturing = true;
    
    // Запуск моніторингу бітрейту для адаптивного регулювання якості
    startBitrateMonitoring();
    
    // Налаштовуємо інтервал захоплення кадрів
    captureInterval = setInterval(() => {
        if (clients.viewers.size > 0) {
            const frameBuffer = captureFrame();
            if (frameBuffer) {
                broadcastFrameToViewers(frameBuffer);
            }
        }
    }, captureConfig.interval);
    
    console.log(`Захоплення екрану запущено з інтервалом ${captureConfig.interval}ms`);
}

// Змінні для таймерів моніторингу бітрейту
let bitrateMonitoringInterval: NodeJS.Timeout | null = null;
let qualityAdjustmentInterval: NodeJS.Timeout | null = null;

/**
 * Запускає моніторинг бітрейту для адаптивного регулювання якості відео
 * Створює інтервал, який періодично перевіряє поточний бітрейт та
 * коригує параметри захоплення для дотримання обмежень
 */
function startBitrateMonitoring(): void {
    console.log('Запуск моніторингу бітрейту...');
    
    // Скидаємо лічильники для початку нового вимірювання
    metrics.bytesSent = 0;
    metrics.lastBitrateCheck = Date.now();
    
    // Запускаємо періодичну перевірку та регулювання якості
    qualityAdjustmentInterval = setInterval(() => {
        // Розраховуємо середній бітрейт з історії
        if (metrics.bitrateHistory.length > 0) {
            const avgBitrate = metrics.bitrateHistory.reduce((sum, val) => sum + val, 0) / metrics.bitrateHistory.length;
            
            // Логуємо поточний середній бітрейт кожні 10 секунд
            console.log(`Поточний середній бітрейт: ${(avgBitrate / (1024 * 1024)).toFixed(2)} Мбіт/с`);
            
            // Якщо бітрейт перевищує ліміт, знижуємо якість або FPS
            if (avgBitrate > trafficLimits.maxBitrate) {
                if (captureConfig.quality > 70) {
                    captureConfig.quality -= 5;
                    if (screenCaptureModule) {
                        screenCaptureModule.setJpegQuality(captureConfig.quality);
                    }
                    console.log(`Якість зменшено до ${captureConfig.quality} для оптимізації трафіку`);
                } else if (captureConfig.fps > 5) {
                    captureConfig.fps -= 2;
                    captureConfig.interval = Math.floor(1000 / captureConfig.fps);
                    
                    if (screenCaptureModule) {
                        screenCaptureModule.setTargetFPS(captureConfig.fps);
                    }
                    
                    // Перезапускаємо захоплення з новим інтервалом
                    if (isCapturing && captureInterval) {
                        clearInterval(captureInterval);
                        captureInterval = setInterval(() => {
                            if (clients.viewers.size > 0) {
                                const frameBuffer = captureFrame();
                                if (frameBuffer) {
                                    broadcastFrameToViewers(frameBuffer);
                                }
                            }
                        }, captureConfig.interval);
                    }
                    
                    console.log(`FPS зменшено до ${captureConfig.fps} для оптимізації трафіку`);
                }
            } else if (avgBitrate < trafficLimits.maxBitrate * 0.7 && 
                      (captureConfig.quality < 85 || captureConfig.fps < 10)) {
                // Якщо бітрейт низький, можемо покращити якість
                if (captureConfig.quality < 85) {
                    captureConfig.quality += 5;
                    if (screenCaptureModule) {
                        screenCaptureModule.setJpegQuality(captureConfig.quality);
                    }
                    console.log(`Якість збільшено до ${captureConfig.quality} для кращої якості відео`);
                } else if (captureConfig.fps < 10) {
                    captureConfig.fps += 1;
                    captureConfig.interval = Math.floor(1000 / captureConfig.fps);
                    
                    if (screenCaptureModule) {
                        screenCaptureModule.setTargetFPS(captureConfig.fps);
                    }
                    
                    // Перезапускаємо захоплення з новим інтервалом
                    if (isCapturing && captureInterval) {
                        clearInterval(captureInterval);
                        captureInterval = setInterval(() => {
                            if (clients.viewers.size > 0) {
                                const frameBuffer = captureFrame();
                                if (frameBuffer) {
                                    broadcastFrameToViewers(frameBuffer);
                                }
                            }
                        }, captureConfig.interval);
                    }
                    
                    console.log(`FPS збільшено до ${captureConfig.fps} для кращого відео`);
                }
            }
        }
    }, trafficLimits.checkInterval);
}

/**
 * Зупиняє моніторинг бітрейту та очищує ресурси
 */
function stopBitrateMonitoring(): void {
    if (qualityAdjustmentInterval) {
        clearInterval(qualityAdjustmentInterval);
        qualityAdjustmentInterval = null;
    }
    
    if (bitrateMonitoringInterval) {
        clearInterval(bitrateMonitoringInterval);
        bitrateMonitoringInterval = null;
    }
    
    console.log('Моніторинг бітрейту зупинено');
}

/**
 * Зупиняє процес захоплення екрану та очищує ресурси
 * Відміняє таймер захоплення та сповіщає нативний модуль про зупинку
 */
function stopCapture(): void {
    if (!isCapturing) {
        console.log('Захоплення екрану вже зупинено');
        return;
    }
    
    console.log('Зупинка захоплення екрану...');
    
    // Очищаємо інтервал захоплення кадрів
    if (captureInterval) {
        clearInterval(captureInterval);
        captureInterval = null;
    }
    
    // Зупиняємо моніторинг бітрейту
    stopBitrateMonitoring();
    
    isCapturing = false;
    
    console.log('Захоплення екрану зупинено');
}

/**
 * Розсилає захоплений кадр усім підключеним глядачам
 * Обробляє помилки при відправці та оновлює статистику
 * 
 * @param frameBuffer Buffer із зображенням у форматі JPEG для відправки
 */
function broadcastFrameToViewers(frameBuffer: Buffer): void {
    if (clients.viewers.size === 0 || !frameBuffer) {
        return;
    }
    
    for (const [clientId, client] of clients.viewers.entries()) {
        try {
            if (client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(frameBuffer, { binary: true });
                metrics.framesSent++;
                metrics.bytesSent += frameBuffer.length;
                
                // Оновлюємо бітрейт в реальному часі
                const now = Date.now();
                const timeDelta = now - metrics.lastBitrateCheck;
                if (timeDelta >= trafficLimits.measurementPeriod) {
                    metrics.bitrate = (metrics.bytesSent * 8) / (timeDelta / 1000); // біт/с
                    metrics.lastBitrateCheck = now;
                    metrics.bytesSent = 0; // Скидаємо лічильник для нового періоду вимірювання
                    
                    // Додаємо значення в історію для аналізу
                    metrics.bitrateHistory.push(metrics.bitrate);
                    if (metrics.bitrateHistory.length > 10) {
                        metrics.bitrateHistory.shift(); // Зберігаємо останні 10 вимірювань
                    }
                }
            }
        } catch (err) {
            console.error(`Помилка відправки кадру клієнту ${clientId}:`, err);
        }
    }
}

// Ініціалізація Express додатку
const app = express();
const server = http.createServer(app);

// Налаштування CORS
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    
    next();
});

// Шлях до статичних файлів
app.use('/public', express.static(path.join(__dirname, '../../public')));
app.use(express.static(path.join(__dirname, '../..')));

// Маршрут головної сторінки
app.get('/', (req: express.Request, res: express.Response) => {
    try {
        const indexPath = path.join(__dirname, '../../public', 'ultra-viewer.html');
        console.log(`Запит на головну сторінку, шлях: ${indexPath}`);
        
        // Перевіряємо наявність файлу
        if (fs.existsSync(indexPath)) {
            res.sendFile(indexPath);
        } else {
            // Якщо файл не знайдено, шукаємо інші HTML файли у папці public
            const publicDir = path.join(__dirname, '../../public');
            if (fs.existsSync(publicDir)) {
                const files = fs.readdirSync(publicDir);
                const htmlFiles = files.filter(file => file.endsWith('.html'));
                
                if (htmlFiles.length > 0) {
                    const firstHtml = path.join(publicDir, htmlFiles[0]);
                    console.log(`Файл ultra-viewer.html не знайдено, використовуємо: ${firstHtml}`);
                    res.sendFile(firstHtml);
                } else {
                    res.status(404).send('Не знайдено HTML файлів у директорії public');
                }
            } else {
                res.status(404).send('Директорія public не знайдена');
            }
        }
    } catch (err) {
        console.error('Помилка при обробці запиту /', err);
        res.status(500).send('Server Error');
    }
});

// Маршрут для перевірки стану сервера
app.get('/api/status', (req: express.Request, res: express.Response) => {
    res.json({
        status: 'ok',
        viewers: clients.viewers.size,
        metrics: {
            framesReceived: metrics.framesReceived,
            framesSent: metrics.framesSent,
            currentFPS: metrics.currentFPS,
            uptime: (Date.now() - metrics.startTime) / 1000,
            bitrate: metrics.bitrate / (1024 * 1024), // в Мбіт/с
            quality: captureConfig.quality,
            scale: captureConfig.scale,
            fps: captureConfig.fps
        }
    });
});

// Запуск сервера
server.listen(PORT, () => {
    console.log(`Сервер запущено на порту ${PORT}`);
    console.log(`Веб-інтерфейс доступний за адресою: http://localhost:${PORT}`);
    
    // Ініціалізація модуля захоплення екрану
    initializeCapture();
    
    // Ініціалізація WebSocket сервера
    console.log('Ініціалізація WebSocket сервера...');
    wss = new WebSocket.Server({
        server,
        perMessageDeflate: {
            zlibDeflateOptions: {
                chunkSize: 1024,
                memLevel: 7,
                level: 3
            },
            zlibInflateOptions: {
                chunkSize: 10 * 1024
            },
            concurrencyLimit: 10,
            threshold: 1024
        },
        clientTracking: true
    });
    
    console.log('WebSocket сервер створено успішно');
    
    // Перевірка з'єднань на живість
    const pingInterval = setInterval(() => {
        if (wss) {
            wss.clients.forEach(function(ws) {
                const extendedWs = ws as WebSocket & { isAlive?: boolean };
                if (extendedWs.isAlive === false) {
                    console.log('Закриття неактивного з\'єднання');
                    return ws.terminate();
                }
                
                extendedWs.isAlive = false;
                
                try {
                    ws.ping();
                } catch (err) {
                    console.error('Помилка відправки ping:', err);
                }
            });
        }
    }, 30000);
    
    if (wss) {
        wss.on('close', () => {
            clearInterval(pingInterval);
        });
        
        // Обробка підключення WebSocket клієнта
        wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
            try {
                const extendedWs = ws as WebSocket & { isAlive?: boolean };
                extendedWs.isAlive = true;
                
                // Обробка pong повідомлень
                ws.on('pong', () => {
                    const extendedWs = ws as WebSocket & { isAlive?: boolean };
                    extendedWs.isAlive = true;
                });
                
                // Генеруємо унікальний ID для клієнта
                const clientId = Math.random().toString(36).substring(2, 15);
                console.log(`Нове підключення від ${req.socket.remoteAddress}`);
                
                // За замовчуванням, новий клієнт - це глядач
                const clientType = CLIENT_TYPES.VIEWER;
                
                // Додаємо клієнта до списку глядачів
                clients.viewers.set(clientId, {
                    ws,
                    type: clientType,
                    id: clientId
                });
                
                console.log(`Клієнт ${clientId} доданий як глядач, всього глядачів: ${clients.viewers.size}`);
                
                // Якщо це перший глядач і захоплення екрану ще не запущене, запускаємо його
                if (clients.viewers.size === 1 && !isCapturing) {
                    startCapture();
                }
                
                // Повідомляємо всіх клієнтів про оновлену кількість глядачів
                broadcastViewerCount();
                
                // Обробка повідомлень від клієнта
                ws.on('message', (message: WebSocket.Data) => {
                    try {
                        // Якщо це бінарне повідомлення (кадр відео)
                        if (Buffer.isBuffer(message)) {
                            return;
                        }
                        
                        // Конвертуємо повідомлення в рядок
                        const messageStr = message.toString();
                        
                        // Парсимо JSON
                        try {
                            const parsedMessage = JSON.parse(messageStr);
                            if (typeof parsedMessage === 'object' && parsedMessage !== null) {
                                // Обробка повідомлення як об'єкта
                                console.log('Отримано повідомлення від клієнта:', parsedMessage);
                                
                                if (parsedMessage.type === 'config') {
                                    console.log(`Отримано конфігурацію від клієнта ${clientId}:`, parsedMessage.config);
                                    
                                    // Оновлюємо конфігурацію
                                    if (parsedMessage.config && parsedMessage.config.quality !== undefined && 
                                        parsedMessage.config.quality >= 1 && parsedMessage.config.quality <= 100) {
                                        captureConfig.quality = parsedMessage.config.quality;
                                        if (screenCaptureModule) {
                                            screenCaptureModule.setJpegQuality(captureConfig.quality);
                                        }
                                    }
                                    
                                    if (parsedMessage.config && parsedMessage.config.fps !== undefined && 
                                        parsedMessage.config.fps >= 1 && parsedMessage.config.fps <= 60) {
                                        captureConfig.fps = parsedMessage.config.fps;
                                        captureConfig.interval = Math.floor(1000 / captureConfig.fps);
                                        
                                        if (screenCaptureModule) {
                                            screenCaptureModule.setTargetFPS(captureConfig.fps);
                                        }
                                        
                                        // Перезапускаємо захоплення з новим інтервалом
                                        if (isCapturing) {
                                            stopCapture();
                                            startCapture();
                                        }
                                    }
                                }
                            }
                        } catch (err) {
                            console.error(`Помилка парсингу повідомлення від клієнта ${clientId}:`, err);
                        }
                    } catch (err) {
                        console.error(`Помилка обробки повідомлення від клієнта ${clientId}:`, err);
                    }
                });
                
                // Обробка закриття з'єднання
                ws.on('close', (code: number, reason: string) => {
                    console.log(`Клієнт ${clientId} від'єднався. Код: ${code}, Причина: ${reason || 'Не вказано'}`);
                    
                    // Видаляємо клієнта з глядачів
                    clients.viewers.delete(clientId);
                    console.log(`Глядач від'єднався, залишилося глядачів: ${clients.viewers.size}`);
                    
                    // Якщо не залишилося глядачів, зупиняємо захоплення екрану
                    if (clients.viewers.size === 0 && isCapturing) {
                        console.log('Немає активних глядачів, зупиняємо захоплення екрану');
                        stopCapture();
                    }
                    
                    // Повідомляємо клієнти про оновлену кількість глядачів
                    broadcastViewerCount();
                });
                
                // Обробка помилок
                ws.on('error', (err: Error) => {
                    console.error(`Помилка WebSocket з'єднання для клієнта ${clientId}:`, err);
                });
                
                // Відправляємо клієнту повідомлення про успішне підключення
                try {
                    ws.send(JSON.stringify({
                        type: 'connected',
                        id: clientId,
                        timestamp: Date.now(),
                        viewerCount: clients.viewers.size
                    }));
                } catch (err) {
                    console.error(`Помилка відправки повідомлення про підключення клієнту ${clientId}:`, err);
                }
            } catch (error) {
                console.error('Помилка при обробці нового WebSocket підключення:', error);
            }
        });
    }
    
    console.log('WebSocket сервер готовий до прийому з\'єднань');
});

/**
 * Розсилає всім клієнтам інформацію про поточну кількість глядачів
 * Важливо для інтерфейсу, щоб відображати актуальну статистику підключень
 */
function broadcastViewerCount(): void {
    const viewerCount = clients.viewers.size;
    
    // Створюємо повідомлення
    const message = JSON.stringify({
        type: 'viewer-count',
        count: viewerCount
    });
    
    // Розсилаємо всім клієнтам
    for (const [clientId, client] of clients.viewers.entries()) {
        try {
            if (client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(message);
            }
        } catch (error) {
            console.error(`Помилка відправки кількості глядачів клієнту ${clientId}:`, error);
        }
    }
}

// Обробка завершення роботи
process.on('SIGINT', () => {
    console.log('Завершення роботи сервера...');
    
    // Зупиняємо захоплення екрану
    stopCapture();
    
    // Виводимо статистику сесії
    const sessionStats = {
        framesReceived: metrics.framesReceived,
        framesSent: metrics.framesSent,
        uptime: (Date.now() - metrics.startTime) / 1000,
        endTime: new Date().toISOString(),
        avgBitrate: metrics.bitrateHistory.length > 0 
            ? (metrics.bitrateHistory.reduce((sum, val) => sum + val, 0) / metrics.bitrateHistory.length / (1024 * 1024)).toFixed(2) + ' Мбіт/с'
            : 'немає даних'
    };
    console.log('Статистика сесії:', sessionStats);
    
    // Завершуємо процес
    process.exit(0);
});

// Обробники необроблених помилок та відхилених обіцянок
process.on('uncaughtException', (err: Error) => {
    console.error('Необроблена помилка:', err);
});

process.on('unhandledRejection', (reason: any) => {
    console.error('Необроблена відхилена обіцянка:', reason);
});

// Додаємо експорт для модульного тестування
export { app, server };
