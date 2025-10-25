/**
 * WebSocket Client для підключення до Backend
 * (Vanilla JavaScript - без TypeScript)
 */

let ws = null;
let isConnected = false;
let reconnectTimeout = null;
let heartbeatInterval = null;
let streamId = null;
let startTime = null;

// Статистика
let stats = {
    framesReceived: 0,
    framesDropped: 0,
    bytesReceived: 0,
    connectionTime: 0
};

function connect() {
    const serverUrl = document.getElementById('serverUrl').value;
    const streamIdValue = document.getElementById('streamIdInput').value;
    
    if (!serverUrl) {
        log('❌ Вкажіть URL сервера');
        showError('Вкажіть URL сервера');
        return;
    }

    log(`🔌 Підключення до ${serverUrl}...`);
    updateStatus('connecting', 'Підключення...');
    
    try {
        ws = new WebSocket(serverUrl);
        
        ws.binaryType = 'arraybuffer';
        
        ws.onopen = () => {
            isConnected = true;
            startTime = Date.now();
            updateStatus('connected', 'Підключено');
            log('✅ WebSocket підключено');
            
            // Відправка ідентифікації
            sendIdentification();
            
            // Запуск heartbeat
            startHeartbeat();
            
            // Якщо є streamId, підключитися до потоку
            if (streamIdValue) {
                joinStream(streamIdValue);
            } else {
                // Автоматично отримати список активних стрімів
                log('⏳ Очікування активних потоків...');
                // Функція вже викликається в sendIdentification()
            }
            
            // Оновити кнопки
            document.getElementById('connectBtn').disabled = true;
            document.getElementById('disconnectBtn').disabled = false;
            document.getElementById('refreshBtn').disabled = false;
            
            hideError();
        };
        
        ws.onmessage = (event) => {
            // Перевірка чи це текстове чи бінарне повідомлення
            if (event.data instanceof ArrayBuffer || event.data instanceof Blob) {
                // Бінарні дані (кадр відео)
                handleBinaryFrame(event.data);
            } else if (typeof event.data === 'string') {
                // Текстове повідомлення
                try {
                    const message = JSON.parse(event.data);
                    handleTextMessage(message);
                } catch (error) {
                    log('❌ Помилка парсингу JSON:', error);
                }
            }
        };
        
        ws.onclose = () => {
            handleDisconnect();
        };
        
        ws.onerror = (error) => {
            log('❌ WebSocket помилка:', error);
            showError('Помилка підключення до сервера');
        };
        
    } catch (error) {
        log('❌ Помилка створення WebSocket:', error);
        showError('Не вдалося підключитися до сервера');
    }
}

function disconnect() {
    log('🔌 Відключення...');
    
    stopHeartbeat();
    
    if (ws) {
        ws.close();
        ws = null;
    }
    
    isConnected = false;
    updateStatus('disconnected', 'Відключено');
    
    // Оновити кнопки
    document.getElementById('connectBtn').disabled = false;
    document.getElementById('disconnectBtn').disabled = true;
    document.getElementById('refreshBtn').disabled = true;
    
    // Зупинити відео
    stopVideo();
}

function handleDisconnect() {
    log('⚠️ WebSocket відключено');
    isConnected = false;
    updateStatus('disconnected', 'Відключено');
    
    stopHeartbeat();
    stopVideo();
    
    // Оновити кнопки
    document.getElementById('connectBtn').disabled = false;
    document.getElementById('disconnectBtn').disabled = true;
    
    // Спроба перепідключення через 5 секунд
    scheduleReconnect();
}

function scheduleReconnect() {
    if (reconnectTimeout) return;
    
    log('🔄 Перепідключення через 5 секунд...');
    
    reconnectTimeout = setTimeout(() => {
        reconnectTimeout = null;
        connect();
    }, 5000);
}

function reconnect() {
    disconnect();
    setTimeout(() => {
        connect();
    }, 500);
}

function sendIdentification() {
    const message = {
        type: 'identification',
        clientType: 'viewer',
        version: '2.0.0',
        userAgent: navigator.userAgent,
        timestamp: Date.now()
    };
    
    log('📤 Відправляємо ідентифікацію як viewer...');
    sendMessage(message);
    log('✅ Ідентифікацію відправлено');
    
    // Через 500ms запитати список активних потоків
    setTimeout(() => {
        requestAvailableStreams();
    }, 500);
}

function requestAvailableStreams() {
    // Запит до HTTP API для отримання списку потоків
    const serverUrl = document.getElementById('serverUrl').value;
    const httpUrl = serverUrl.replace('ws://', 'http://').replace('wss://', 'https://');
    
    log('🔍 Запит активних потоків...');
    
    fetch(`${httpUrl}/api/streams`)
        .then(response => response.json())
        .then(data => {
            log(`📊 Отримано ${data.streams.length} потоків`);
            
            if (data.streams.length > 0) {
                const firstStream = data.streams[0];
                log(`🎯 Автоматичне підключення до потоку: ${firstStream.streamId}`);
                joinStream(firstStream.streamId);
            } else {
                log('⏳ Немає активних потоків. Очікування...');
            }
        })
        .catch(error => {
            log('❌ Помилка запиту потоків:', error);
        });
}

function joinStream(streamIdValue) {
    const message = {
        type: 'join_stream',
        streamId: streamIdValue,
        timestamp: Date.now()
    };
    
    sendMessage(message);
    log(`📺 Приєднання до потоку: ${streamIdValue}`);
    
    streamId = streamIdValue;
    updateStreamId(streamIdValue);
}

function handleTextMessage(message) {
    log(`📥 Отримано повідомлення: ${message.type}`, message);
    
    switch (message.type) {
        case 'welcome':
            log(`👋 Вітаємо! Client ID: ${message.clientId}`);
            break;
            
        case 'stream_created':
            log(`📹 Потік створено: ${message.streamId}`);
            streamId = message.streamId;
            updateStreamId(message.streamId);
            joinStream(message.streamId);
            break;
            
        case 'joined_stream':
            log(`✅ Приєдналися до потоку: ${message.streamId}`);
            showLoading();
            break;
            
        case 'frame_metadata':
            handleFrameMetadata(message);
            break;
            
        case 'stream_ended':
            log('⚠️ Потік завершено');
            showError('Потік завершено');
            stopVideo();
            break;
            
        case 'error':
            log(`❌ Помилка: ${message.message}`);
            showError(message.message);
            break;
            
        case 'pong':
            // Відповідь на heartbeat
            break;
            
        default:
            log(`⚠️ Невідоме повідомлення: ${message.type}`);
    }
}

let pendingMetadata = null;

function handleFrameMetadata(metadata) {
    pendingMetadata = metadata;
    
    // Оновити роздільність
    updateResolution(metadata.width, metadata.height);
}

function handleBinaryFrame(arrayBuffer) {
    if (!pendingMetadata) {
        log('⚠️ Отримано кадр без метаданих');
        return;
    }
    
    const frameData = new Uint8Array(arrayBuffer);
    
    // Оновити статистику
    stats.framesReceived++;
    stats.bytesReceived += frameData.length;
    
    updateStats();
    
    // Передати кадр у відеоплеєр
    onFrameReceived(frameData, pendingMetadata);
    
    pendingMetadata = null;
    
    hideLoading();
}

function sendMessage(message) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    }
}

function startHeartbeat() {
    heartbeatInterval = setInterval(() => {
        if (isConnected && ws && ws.readyState === WebSocket.OPEN) {
            sendMessage({
                type: 'heartbeat',
                timestamp: Date.now()
            });
        }
    }, 30000); // Кожні 30 секунд
}

function stopHeartbeat() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
}

// Оновлення UI
function updateStatus(status, text) {
    const statusElement = document.getElementById('connectionStatus');
    statusElement.textContent = text;
    statusElement.className = `status-value ${status}`;
}

function updateStreamId(id) {
    document.getElementById('streamId').textContent = id || '-';
}

function updateResolution(width, height) {
    document.getElementById('resolution').textContent = `${width}x${height}`;
}

function updateStats() {
    document.getElementById('framesReceived').textContent = stats.framesReceived;
    document.getElementById('framesDropped').textContent = stats.framesDropped;
    document.getElementById('bytesReceived').textContent = 
        (stats.bytesReceived / 1024 / 1024).toFixed(2) + ' MB';
    
    if (startTime) {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        document.getElementById('connectionTime').textContent = elapsed + 's';
    }
}

function showLoading() {
    document.getElementById('loadingOverlay').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

function showError(message) {
    const errorOverlay = document.getElementById('errorOverlay');
    document.getElementById('errorMessage').textContent = message;
    errorOverlay.style.display = 'flex';
}

function hideError() {
    document.getElementById('errorOverlay').style.display = 'none';
}

function log(message, ...args) {
    const logContainer = document.getElementById('logContainer');
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    logEntry.textContent = `[${timestamp}] ${message}`;
    
    if (args.length > 0) {
        logEntry.textContent += ' ' + JSON.stringify(args);
    }
    
    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;
    
    console.log(message, ...args);
}

function clearLog() {
    document.getElementById('logContainer').innerHTML = '';
}

function refreshStreams() {
    log('🔄 Оновлення списку стрімів...');
    requestAvailableStreams();
}

// Оновлення статистики кожну секунду
setInterval(() => {
    if (isConnected) {
        updateStats();
    }
}, 1000);
