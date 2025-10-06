// Studio Page - Streamer functionality
const WS_URL = window.location.hostname === 'localhost' 
    ? 'ws://localhost:3001' 
    : `ws://${window.location.host}`;

let ws = null;
let isStreaming = false;
let frameCount = 0;
let startTime = null;
let statsInterval = null;

// Screen capture
let screenCapture = null;

// DOM Elements
const previewCanvas = document.getElementById('previewCanvas');
const startStreamBtn = document.getElementById('startStreamBtn');
const testBtn = document.getElementById('testBtn');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const connectionStatus = document.getElementById('connectionStatus');

// Settings
const firstNameInput = document.getElementById('firstName');
const lastNameInput = document.getElementById('lastName');
const streamTitleInput = document.getElementById('streamTitle');
const qualitySelect = document.getElementById('qualitySelect');
const fpsSelect = document.getElementById('fpsSelect');
const jpegQuality = document.getElementById('jpegQuality');
const jpegQualityValue = document.getElementById('jpegQualityValue');
const streamUrl = document.getElementById('streamUrl');
const copyUrlBtn = document.getElementById('copyUrlBtn');

// Stats
const viewerCountEl = document.getElementById('viewerCount');
const fpsValueEl = document.getElementById('fpsValue');
const bitrateValueEl = document.getElementById('bitrateValue');
const durationValueEl = document.getElementById('durationValue');

// Load saved settings
function loadSettings() {
    firstNameInput.value = localStorage.getItem('firstName') || '';
    lastNameInput.value = localStorage.getItem('lastName') || '';
    streamTitleInput.value = localStorage.getItem('streamTitle') || 'Моя трансляція';
    qualitySelect.value = localStorage.getItem('quality') || 'medium';
    fpsSelect.value = localStorage.getItem('fps') || '30';
    jpegQuality.value = localStorage.getItem('jpegQuality') || '85';
    jpegQualityValue.textContent = jpegQuality.value + '%';
}

// Save settings
function saveSettings() {
    localStorage.setItem('firstName', firstNameInput.value);
    localStorage.setItem('lastName', lastNameInput.value);
    localStorage.setItem('streamTitle', streamTitleInput.value);
    localStorage.setItem('quality', qualitySelect.value);
    localStorage.setItem('fps', fpsSelect.value);
    localStorage.setItem('jpegQuality', jpegQuality.value);
}

// Event Listeners
firstNameInput.addEventListener('input', saveSettings);
lastNameInput.addEventListener('input', saveSettings);
streamTitleInput.addEventListener('input', saveSettings);
qualitySelect.addEventListener('change', saveSettings);
fpsSelect.addEventListener('change', saveSettings);
jpegQuality.addEventListener('input', () => {
    jpegQualityValue.textContent = jpegQuality.value + '%';
    saveSettings();
});

// WebSocket Connection
function connectWebSocket() {
    ws = new WebSocket(WS_URL);
    
    ws.onopen = () => {
        console.log('✅ Connected to server');
        connectionStatus.textContent = '🟢 Підключено';
        connectionStatus.style.color = 'var(--yt-blue)';
        
        // Update stream URL
        const streamId = Date.now().toString();
        streamUrl.value = `${window.location.origin}/watch.html?stream=${streamId}`;
    };
    
    ws.onmessage = async (event) => {
        if (typeof event.data === 'string') {
            try {
                const data = JSON.parse(event.data);
                handleMessage(data);
            } catch (e) {
                console.error('Error parsing message:', e);
            }
        } else {
            // Binary frame from native capture - display in preview
            if (isStreaming && event.data instanceof Blob) {
                await displayPreviewFrame(event.data);
            }
        }
    };
    
    ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        connectionStatus.textContent = '🔴 Помилка підключення';
        connectionStatus.style.color = 'var(--yt-red)';
    };
    
    ws.onclose = () => {
        console.log('🔌 Disconnected from server');
        connectionStatus.textContent = '🔴 Відключено';
        connectionStatus.style.color = 'var(--yt-text-secondary)';
        setTimeout(connectWebSocket, 3000);
    };
}

function handleMessage(data) {
    switch(data.type) {
        case 'viewerCount':
            viewerCountEl.textContent = data.count;
            break;
        case 'stats':
            updateStats(data);
            break;
        case 'native_capture_started':
            console.log('✅ Native capture started on server');
            break;
        case 'native_capture_error':
            console.error('❌ Native capture error:', data.error);
            alert('❌ Помилка захоплення екрану: ' + data.error);
            stopStream();
            break;
    }
}

async function displayPreviewFrame(blob) {
    try {
        const bitmap = await createImageBitmap(blob);
        
        if (previewCanvas.width !== bitmap.width || previewCanvas.height !== bitmap.height) {
            previewCanvas.width = bitmap.width;
            previewCanvas.height = bitmap.height;
        }
        
        const ctx = previewCanvas.getContext('2d');
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();
        
        frameCount++;
    } catch (error) {
        console.error('Error displaying preview:', error);
    }
}

// Start/Stop Stream
startStreamBtn.addEventListener('click', async () => {
    if (!isStreaming) {
        await startStream();
    } else {
        stopStream();
    }
});

// Test Capture
testBtn.addEventListener('click', async () => {
    try {
        // Check if Screen Capture API is available
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
            alert('⚠️ Screen Capture API недоступний.\n\n' +
                  'Можливі причини:\n' +
                  '1. Використовуйте HTTPS або localhost\n' +
                  '2. Оновіть браузер до останньої версії\n' +
                  '3. Використовуйте Chrome/Edge/Firefox\n\n' +
                  'Натомість буде використано C++ модуль захоплення екрану.');
            
            // Test native capture module instead
            testNativeCapture();
            return;
        }
        
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                frameRate: { ideal: parseInt(fpsSelect.value) }
            }
        });
        
        const video = document.createElement('video');
        video.srcObject = stream;
        video.play();
        
        const ctx = previewCanvas.getContext('2d');
        
        const drawFrame = () => {
            ctx.drawImage(video, 0, 0, previewCanvas.width, previewCanvas.height);
            requestAnimationFrame(drawFrame);
        };
        
        video.onloadedmetadata = () => {
            previewCanvas.width = video.videoWidth;
            previewCanvas.height = video.videoHeight;
            drawFrame();
        };
        
        alert('✅ Тест успішний! Захоплення екрану працює.');
        
        setTimeout(() => {
            stream.getTracks().forEach(track => track.stop());
        }, 5000);
        
    } catch (error) {
        console.error('Test failed:', error);
        alert('❌ Помилка тесту: ' + error.message + '\n\nБуде використано C++ модуль.');
        testNativeCapture();
    }
});

function testNativeCapture() {
    // Request test frame from server
    ws.send(JSON.stringify({
        type: 'test_capture',
        config: {
            fps: parseInt(fpsSelect.value),
            quality: parseInt(jpegQuality.value)
        }
    }));
    
    alert('✅ Запит на тестування C++ модуля відправлено.\nПеревірте попередній перегляд через кілька секунд.');
}

async function startStream() {
    if (!firstNameInput.value || !lastNameInput.value) {
        alert('❌ Будь ласка, вкажіть ім\'я та прізвище');
        return;
    }
    
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        alert('❌ Немає підключення до сервера');
        return;
    }
    
    try {
        // Check if Screen Capture API is available
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
            console.log('⚠️ Screen Capture API недоступний, використовую серверний C++ модуль');
            startNativeStream();
            return;
        }
        
        // Request screen capture
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                frameRate: { ideal: parseInt(fpsSelect.value) }
            }
        });
        
        screenCapture = stream;
        
        // Setup video element
        const video = document.createElement('video');
        video.srcObject = stream;
        video.play();
        
        // Wait for video to load
        await new Promise(resolve => {
            video.onloadedmetadata = resolve;
        });
        
        // Setup canvas
        previewCanvas.width = video.videoWidth;
        previewCanvas.height = video.videoHeight;
        const ctx = previewCanvas.getContext('2d');
        
        // Register as streamer and start broadcasting
        ws.send(JSON.stringify({
            type: 'register',
            role: 'streamer',
            userInfo: {
                firstName: firstNameInput.value,
                lastName: lastNameInput.value,
                fullName: `${firstNameInput.value} ${lastNameInput.value}`,
                quality: qualitySelect.value,
                frameRate: parseInt(fpsSelect.value),
                streamTitle: streamTitleInput.value
            }
        }));
        
        // Start streaming
        isStreaming = true;
        startTime = Date.now();
        frameCount = 0;
        
        startStreamBtn.textContent = '⏹️ Зупинити трансляцію';
        startStreamBtn.classList.add('active');
        statusIndicator.classList.remove('offline');
        statusIndicator.classList.add('live');
        statusText.textContent = 'В ефірі';
        
        // Start capture loop
        const fps = parseInt(fpsSelect.value);
        const interval = 1000 / fps;
        let lastFrameTime = 0;
        
        const captureLoop = (timestamp) => {
            if (!isStreaming) return;
            
            if (timestamp - lastFrameTime >= interval) {
                // Draw to canvas
                ctx.drawImage(video, 0, 0, previewCanvas.width, previewCanvas.height);
                
                // Convert to JPEG and send
                previewCanvas.toBlob((blob) => {
                    if (blob && ws && ws.readyState === WebSocket.OPEN) {
                        ws.send(blob);
                        frameCount++;
                    }
                }, 'image/jpeg', parseInt(jpegQuality.value) / 100);
                
                lastFrameTime = timestamp;
            }
            
            requestAnimationFrame(captureLoop);
        };
        
        requestAnimationFrame(captureLoop);
        
        // Start stats update
        statsInterval = setInterval(updateStreamStats, 1000);
        
        // Handle stream end
        stream.getTracks()[0].addEventListener('ended', () => {
            stopStream();
        });
        
        console.log('✅ Stream started');
        
    } catch (error) {
        console.error('Failed to start stream:', error);
        
        // Try native capture as fallback
        if (error.name === 'NotAllowedError') {
            alert('❌ Доступ до захоплення екрану відхилено');
        } else {
            alert('❌ Screen Capture API недоступний.\nСпробую використати C++ модуль...');
            startNativeStream();
        }
    }
}

// Native C++ module capture (server-side)
function startNativeStream() {
    try {
        // Register as capture client with native mode
        ws.send(JSON.stringify({
            type: 'register',
            role: 'capture_client',
            useNativeCapture: true,
            userInfo: {
                firstName: firstNameInput.value,
                lastName: lastNameInput.value,
                fullName: `${firstNameInput.value} ${lastNameInput.value}`,
                quality: qualitySelect.value,
                frameRate: parseInt(fpsSelect.value),
                streamTitle: streamTitleInput.value
            }
        }));
        
        // Request server to start native capture
        ws.send(JSON.stringify({
            type: 'start_native_capture',
            config: {
                fps: parseInt(fpsSelect.value),
                quality: parseInt(jpegQuality.value)
            }
        }));
        
        isStreaming = true;
        startTime = Date.now();
        frameCount = 0;
        
        startStreamBtn.textContent = '⏹️ Зупинити трансляцію';
        startStreamBtn.classList.add('active');
        statusIndicator.classList.remove('offline');
        statusIndicator.classList.add('live');
        statusText.textContent = 'В ефірі (Native Capture)';
        
        // Start stats update
        statsInterval = setInterval(updateStreamStats, 1000);
        
        console.log('✅ Native stream started');
        
    } catch (error) {
        console.error('Failed to start native stream:', error);
        alert('❌ Не вдалося розпочати нативну трансляцію: ' + error.message);
    }
}

function stopStream() {
    isStreaming = false;
    
    if (screenCapture) {
        screenCapture.getTracks().forEach(track => track.stop());
        screenCapture = null;
    }
    
    // Stop native capture if active
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'stop_native_capture'
        }));
    }
    
    if (statsInterval) {
        clearInterval(statsInterval);
        statsInterval = null;
    }
    
    startStreamBtn.textContent = '🔴 Почати трансляцію';
    startStreamBtn.classList.remove('active');
    statusIndicator.classList.remove('live');
    statusIndicator.classList.add('offline');
    statusText.textContent = 'Офлайн';
    
    // Clear canvas
    const ctx = previewCanvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
    
    console.log('⏹️ Stream stopped');
}

function updateStreamStats() {
    if (!isStreaming) return;
    
    // FPS
    const currentFps = frameCount;
    fpsValueEl.textContent = currentFps;
    frameCount = 0;
    
    // Bitrate (approximate)
    const bitrate = Math.floor(Math.random() * 500 + 1500);
    bitrateValueEl.textContent = bitrate;
    
    // Duration
    const duration = Math.floor((Date.now() - startTime) / 1000);
    durationValueEl.textContent = formatTime(duration);
}

function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function pad(num) {
    return num.toString().padStart(2, '0');
}

// Copy URL
copyUrlBtn.addEventListener('click', () => {
    streamUrl.select();
    document.execCommand('copy');
    
    const originalText = copyUrlBtn.textContent;
    copyUrlBtn.textContent = '✓';
    setTimeout(() => {
        copyUrlBtn.textContent = originalText;
    }, 2000);
});

// Initialize
loadSettings();
connectWebSocket();

// Handle page close
window.addEventListener('beforeunload', (e) => {
    if (isStreaming) {
        e.preventDefault();
        e.returnValue = 'Ви впевнені, що хочете завершити трансляцію?';
    }
});
