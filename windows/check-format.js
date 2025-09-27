// Простий скрипт для перевірки формату кадрів від серверу
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

console.log('Запуск перевірки формату кадрів...');

// URL сервера
const wsUrl = 'ws://localhost:3000';
let frameCount = 0;

// Створення директорії для збереження кадрів
const framesDir = path.join(__dirname, 'frames');
if (!fs.existsSync(framesDir)) {
    fs.mkdirSync(framesDir);
    console.log(`Створено директорію: ${framesDir}`);
}

// Підключення до сервера
console.log(`Підключення до сервера: ${wsUrl}`);
const ws = new WebSocket(wsUrl);

ws.on('open', () => {
    console.log('Успішно підключено до сервера');
    
    // Відправляємо ідентифікацію як глядач
    ws.send(JSON.stringify({
        type: 'identify',
        role: 'viewer',
        clientInfo: {
            userAgent: 'FormatChecker',
            language: 'uk',
            screenWidth: 1920,
            screenHeight: 1080
        }
    }));
    
    console.log('Очікуємо кадри...');
});

ws.on('message', (data) => {
    try {
        // Перевіряємо, чи це бінарні дані (кадр)
        if (Buffer.isBuffer(data)) {
            frameCount++;
            
            // Аналізуємо формат даних
            if (data.length === 0) {
                console.log('Отримано порожній буфер!');
                return;
            }
            
            // Перевіряємо JPEG заголовок
            const isJpeg = data[0] === 0xFF && data[1] === 0xD8 && 
                           data[data.length-2] === 0xFF && data[data.length-1] === 0xD9;
            
            // Перевіряємо PNG заголовок
            const isPng = data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47;
            
            console.log(`Кадр #${frameCount}: розмір ${data.length} байт`);
            console.log(`Перші 16 байт: ${data.slice(0, 16).toString('hex')}`);
            console.log(`Останні 16 байт: ${data.slice(data.length-16).toString('hex')}`);
            console.log(`Формат: ${isJpeg ? 'JPEG' : isPng ? 'PNG' : 'Невідомий'}`);
            
            // Зберігаємо перші 5 кадрів та кожен 20-й
            if (frameCount <= 5 || frameCount % 20 === 0) {
                const extension = isJpeg ? 'jpg' : isPng ? 'png' : 'bin';
                const filename = path.join(framesDir, `frame_${frameCount}.${extension}`);
                fs.writeFileSync(filename, data);
                console.log(`Кадр збережено: ${filename}`);
                
                // Також зберігаємо версію кадру з доданими JPEG заголовками
                if (!isJpeg && !isPng) {
                    const jpegHeader = Buffer.from([
                        0xFF, 0xD8, // SOI
                        0xFF, 0xE0, // APP0
                        0x00, 0x10, // Length
                        0x4A, 0x46, 0x49, 0x46, 0x00, // JFIF\0
                        0x01, 0x01, // Version
                        0x00, // Density units
                        0x00, 0x01, 0x00, 0x01, // Density
                        0x00, 0x00 // Thumbnail
                    ]);
                    const jpegFooter = Buffer.from([0xFF, 0xD9]); // EOI
                    const fixedFrame = Buffer.concat([jpegHeader, data, jpegFooter]);
                    const fixedFilename = path.join(framesDir, `frame_${frameCount}_fixed.jpg`);
                    fs.writeFileSync(fixedFilename, fixedFrame);
                    console.log(`Створено виправлений кадр: ${fixedFilename}`);
                }
            }
            
            // Завершуємо після 30 кадрів
            if (frameCount >= 30) {
                console.log('Перевірку завершено, закриття з\'єднання');
                ws.close();
                
                // Створюємо HTML для перегляду кадрів
                createHtmlViewer();
            }
        } else {
            // Якщо це текстове повідомлення, виводимо його
            console.log('Отримано текстове повідомлення від сервера:', data.toString());
        }
    } catch (err) {
        console.error('Помилка обробки даних:', err);
    }
});

ws.on('close', () => {
    console.log('З\'єднання з сервером закрито');
    if (frameCount === 0) {
        console.log('Не отримано жодного кадру. Можливо, сервер не надсилає відео.');
    }
});

ws.on('error', (err) => {
    console.error('Помилка з\'єднання:', err);
});

// Створення HTML сторінки для перегляду збережених кадрів
function createHtmlViewer() {
    try {
        // Отримуємо список збережених файлів
        const files = fs.readdirSync(framesDir).filter(file => 
            file.endsWith('.jpg') || file.endsWith('.png') || file.endsWith('.bin')
        );
        
        if (files.length === 0) {
            console.log('Немає файлів для перегляду');
            return;
        }
        
        // Створюємо HTML
        let html = `
<!DOCTYPE html>
<html lang="uk">
<head>
    <meta charset="UTF-8">
    <title>Перегляд кадрів</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f0f0f0; }
        .container { max-width: 1200px; margin: 0 auto; }
        .frame { margin-bottom: 30px; padding: 15px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .frame img { max-width: 100%; display: block; margin: 10px 0; }
        h1, h2 { color: #333; }
        .hex { font-family: monospace; background: #eee; padding: 10px; overflow-x: auto; }
        .warning { color: red; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Аналіз кадрів відео</h1>
        <p>Всього проаналізовано кадрів: ${frameCount}</p>
`;
        
        // Додаємо секцію для кожного файлу
        files.forEach(file => {
            const filePath = path.join(framesDir, file);
            const data = fs.readFileSync(filePath);
            const isJpeg = data[0] === 0xFF && data[1] === 0xD8;
            const isPng = data[0] === 0x89 && data[1] === 0x50;
            const firstBytes = data.slice(0, 16).toString('hex');
            const lastBytes = data.slice(data.length-16).toString('hex');
            
            html += `
        <div class="frame">
            <h2>Файл: ${file}</h2>
            <p>Розмір: ${data.length} байт</p>
            <p>Формат: ${isJpeg ? 'JPEG' : isPng ? 'PNG' : '<span class="warning">Невідомий</span>'}</p>
            <div class="hex">
                <p>Перші 16 байт: ${firstBytes}</p>
                <p>Останні 16 байт: ${lastBytes}</p>
            </div>
`;
            
            // Додаємо зображення, якщо це відомий формат
            if (isJpeg || isPng) {
                html += `            <img src="frames/${file}" alt="${file}">
`;
            } else {
                html += `            <p class="warning">Неможливо відобразити (невідомий формат)</p>
`;
            }
            
            html += `        </div>
`;
        });
        
        html += `    </div>
</body>
</html>`;
        
        // Зберігаємо HTML
        const htmlPath = path.join(__dirname, 'frames-viewer.html');
        fs.writeFileSync(htmlPath, html);
        console.log(`Створено HTML для перегляду кадрів: ${htmlPath}`);
    } catch (err) {
        console.error('Помилка при створенні HTML:', err);
    }
}
