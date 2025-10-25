/**
 * Stream Player - відображення H.264 потоку
 * Використовує Media Source Extensions (MSE) або blob URLs
 */

let videoElement = null;
let mediaSource = null;
let sourceBuffer = null;
let frameQueue = [];
let isProcessingQueue = false;
let currentFps = 0;
let lastFrameTime = 0;
let frameCount = 0;
let fpsUpdateInterval = null;

// Ініціалізація
document.addEventListener('DOMContentLoaded', () => {
    videoElement = document.getElementById('videoPlayer');
    initFpsMonitor();
});

/**
 * Обробка отриманого кадру
 */
function onFrameReceived(frameData, metadata) {
    // Оновити лічильник FPS
    updateFps();
    
    // Спробувати відобразити через MSE або blob
    try {
        displayFrameWithBlob(frameData, metadata);
    } catch (error) {
        console.error('Помилка відображення кадру:', error);
        log('❌ Помилка відображення кадру:', error.message);
    }
}

/**
 * Відображення через Blob URL (простіший метод)
 * Працює для JPEG/PNG кадрів
 */
function displayFrameWithBlob(frameData, metadata) {
    // Створити blob з даних кадру
    const blob = new Blob([frameData], { type: 'image/jpeg' });
    const url = URL.createObjectURL(blob);
    
    // Оновити src відео (для MJPEG можна використовувати <img>)
    // Для справжнього H.264 потрібна MSE
    
    // Тимчасове рішення: показати як зображення
    videoElement.poster = url;
    
    // Очистити старий URL
    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 100);
}

/**
 * Відображення через Media Source Extensions (для H.264)
 * TODO: Повна реалізація MSE
 */
function displayFrameWithMSE(frameData, metadata) {
    if (!mediaSource) {
        initMediaSource();
    }
    
    // Додати кадр до черги
    frameQueue.push({
        data: frameData,
        metadata: metadata
    });
    
    // Обробити чергу
    processFrameQueue();
}

/**
 * Ініціалізація Media Source Extensions
 */
function initMediaSource() {
    if (!('MediaSource' in window)) {
        log('⚠️ MediaSource Extensions не підтримується');
        return;
    }
    
    mediaSource = new MediaSource();
    videoElement.src = URL.createObjectURL(mediaSource);
    
    mediaSource.addEventListener('sourceopen', () => {
        log('✅ MediaSource відкрито');
        
        try {
            // Створити SourceBuffer для H.264
            sourceBuffer = mediaSource.addSourceBuffer('video/mp4; codecs="avc1.42E01E"');
            
            sourceBuffer.addEventListener('updateend', () => {
                isProcessingQueue = false;
                processFrameQueue();
            });
            
            sourceBuffer.addEventListener('error', (e) => {
                log('❌ SourceBuffer помилка:', e);
            });
            
        } catch (error) {
            log('❌ Помилка створення SourceBuffer:', error);
        }
    });
    
    mediaSource.addEventListener('sourceclose', () => {
        log('⚠️ MediaSource закрито');
    });
}

/**
 * Обробка черги кадрів
 */
function processFrameQueue() {
    if (isProcessingQueue || !sourceBuffer || sourceBuffer.updating) {
        return;
    }
    
    if (frameQueue.length === 0) {
        return;
    }
    
    isProcessingQueue = true;
    
    const frame = frameQueue.shift();
    
    try {
        sourceBuffer.appendBuffer(frame.data);
    } catch (error) {
        log('❌ Помилка appendBuffer:', error);
        isProcessingQueue = false;
    }
}

/**
 * Зупинка відео
 */
function stopVideo() {
    if (mediaSource && mediaSource.readyState === 'open') {
        try {
            mediaSource.endOfStream();
        } catch (error) {
            console.error('Помилка endOfStream:', error);
        }
    }
    
    frameQueue = [];
    isProcessingQueue = false;
    
    if (videoElement) {
        videoElement.pause();
        videoElement.src = '';
        videoElement.poster = '';
    }
    
    mediaSource = null;
    sourceBuffer = null;
    
    // Скинути FPS
    currentFps = 0;
    updateFpsDisplay(0);
}

/**
 * Моніторинг FPS
 */
function initFpsMonitor() {
    fpsUpdateInterval = setInterval(() => {
        const now = Date.now();
        const elapsed = (now - lastFrameTime) / 1000;
        
        if (elapsed > 0 && frameCount > 0) {
            currentFps = frameCount / elapsed;
            updateFpsDisplay(Math.round(currentFps * 10) / 10);
        } else {
            updateFpsDisplay(0);
        }
        
        // Скинути лічильники
        frameCount = 0;
        lastFrameTime = now;
    }, 1000);
}

function updateFps() {
    frameCount++;
    if (lastFrameTime === 0) {
        lastFrameTime = Date.now();
    }
}

function updateFpsDisplay(fps) {
    document.getElementById('fps').textContent = fps;
}

/**
 * Очищення ресурсів
 */
window.addEventListener('beforeunload', () => {
    stopVideo();
    
    if (fpsUpdateInterval) {
        clearInterval(fpsUpdateInterval);
    }
});
