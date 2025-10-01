// Тест нативного модуля захоплення екрану
const path = require('path');

console.log('🧪 Тестування нативного модуля захоплення екрану...\n');

try {
    // Пробуємо завантажити нативний модуль
    const screenCapture = require('../native/build/Release/screen_capture.node');
    console.log('✅ Нативний модуль завантажено успішно');

    // Ініціалізація
    const initResult = screenCapture.initCapture();
    if (initResult) {
        console.log('✅ Ініціалізація успішна');

        // Отримуємо інформацію про екран
        const screenInfo = screenCapture.getScreenInfo();
        console.log(`📺 Роздільна здатність екрану: ${screenInfo.width}x${screenInfo.height}`);

        // Тестуємо захоплення кадру
        console.log('📸 Тестуємо захоплення кадру...');
        const startTime = Date.now();
        
        const frameBuffer = screenCapture.captureScreen();
        
        const captureTime = Date.now() - startTime;
        
        if (frameBuffer && frameBuffer.length > 0) {
            console.log(`✅ Кадр захоплено успішно!`);
            console.log(`📦 Розмір кадру: ${(frameBuffer.length / 1024).toFixed(1)} КБ`);
            console.log(`⚡ Час захоплення: ${captureTime}мс`);
            
            // Тест FPS
            console.log('\n🎯 Тест продуктивності (10 кадрів)...');
            const frameCount = 10;
            const fpsTestStart = Date.now();
            
            for (let i = 0; i < frameCount; i++) {
                const frame = screenCapture.captureScreen();
                if (!frame || frame.length === 0) {
                    console.log(`❌ Помилка захоплення кадру ${i + 1}`);
                    break;
                }
                
                // Невелика затримка між кадрами
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            
            const fpsTestTime = Date.now() - fpsTestStart;
            const avgFps = (frameCount / (fpsTestTime / 1000)).toFixed(2);
            const avgFrameTime = (fpsTestTime / frameCount).toFixed(2);
            
            console.log(`📊 Результати тесту:`);
            console.log(`   • Середній FPS: ${avgFps}`);
            console.log(`   • Середній час на кадр: ${avgFrameTime}мс`);
            console.log(`   • Загальний час: ${fpsTestTime}мс`);
            
        } else {
            console.log('❌ Не вдалося захопити кадр');
        }

        // Очищення
        screenCapture.cleanupCapture();
        console.log('✅ Очищення завершено');

    } else {
        console.log('❌ Помилка ініціалізації');
    }

} catch (error) {
    console.error('❌ Помилка тестування:', error.message);
    
    if (error.code === 'MODULE_NOT_FOUND') {
        console.log('\n💡 Нативний модуль не знайдено. Для збірки виконайте:');
        console.log('   npm run build:native');
        console.log('\n📋 Вимоги для збірки:');
        console.log('   • Visual Studio Build Tools');
        console.log('   • Python 3.x');
        console.log('   • Node.js headers');
    }
}

// Додаткова функція для async/await
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    // Тест виконується тут
}

if (require.main === module) {
    main().catch(console.error);
}