// Watch Page - Viewer functionality
const WS_URL = window.location.hostname === 'localhost' 
    ? 'ws://localhost:3001' 
    : `ws://${window.location.host}`;

let ws = null;
let isPlaying = true;
let frameCount = 0;
let lastFrameTime = Date.now();
let streamInfo = null;

// DOM Elements
const videoCanvas = document.getElementById('videoCanvas');
const videoContainer = document.getElementById('videoContainer');
const loadingIndicator = document.getElementById('loadingIndicator');
const offlineIndicator = document.getElementById('offlineIndicator');

const playPauseBtn = document.getElementById('playPauseBtn');
const volumeBtn = document.getElementById('volumeBtn');
const qualityBtn = document.getElementById('qualityBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');

const liveIndicator = document.getElementById('liveIndicator');
const streamTitle = document.getElementById('streamTitle');
const viewerCount = document.getElementById('viewerCount');
const streamDuration = document.getElementById('streamDuration');
const streamerName = document.getElementById('streamerName');
const streamerInfo = document.getElementById('streamerInfo');

const currentFps = document.getElementById('currentFps');
const currentQuality = document.getElementById('currentQuality');
const currentResolution = document.getElementById('currentResolution');
const currentLatency = document.getElementById('currentLatency');

const likeBtn = document.getElementById('likeBtn');
const shareBtn = document.getElementById('shareBtn');
const likeCount = document.getElementById('likeCount');

const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');

// Get stream ID from URL
const urlParams = new URLSearchParams(window.location.search);
const streamId = urlParams.get('stream');

// Canvas context
const ctx = videoCanvas.getContext('2d');

// WebSocket Connection
function connectWebSocket() {
    ws = new WebSocket(WS_URL);
    
    ws.onopen = () => {
        console.log('✅ Connected to server');
        loadingIndicator.style.display = 'flex';
        offlineIndicator.style.display = 'none';
        
        // Register as viewer
        ws.send(JSON.stringify({
            type: 'register',
            role: 'viewer',
            streamId: streamId
        }));
        
        // Request stream info
        ws.send(JSON.stringify({
            type: 'getStreamInfo',
            streamId: streamId
        }));
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
            // Binary frame data
            if (isPlaying) {
                await displayFrame(event.data);
                frameCount++;
                updateStats();
            }
        }
    };
    
    ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        showOffline();
    };
    
    ws.onclose = () => {
        console.log('🔌 Disconnected from server');
        showOffline();
        setTimeout(connectWebSocket, 3000);
    };
}

function handleMessage(data) {
    switch(data.type) {
        case 'streamInfo':
            updateStreamInfo(data.info);
            break;
        case 'viewerCount':
            viewerCount.textContent = `${data.count} глядачів`;
            break;
        case 'streamStarted':
            loadingIndicator.style.display = 'none';
            liveIndicator.style.display = 'flex';
            break;
        case 'streamEnded':
            showOffline();
            break;
        case 'chat':
            addChatMessage(data);
            break;
    }
}

async function displayFrame(blob) {
    try {
        const bitmap = await createImageBitmap(blob);
        
        // Resize canvas if needed
        if (videoCanvas.width !== bitmap.width || videoCanvas.height !== bitmap.height) {
            videoCanvas.width = bitmap.width;
            videoCanvas.height = bitmap.height;
            currentResolution.textContent = `${bitmap.width}x${bitmap.height}`;
        }
        
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();
        
        // Hide loading indicator on first frame
        if (loadingIndicator.style.display !== 'none') {
            loadingIndicator.style.display = 'none';
        }
        
    } catch (error) {
        console.error('Error displaying frame:', error);
    }
}

function updateStreamInfo(info) {
    if (!info) return;
    
    streamInfo = info;
    streamTitle.textContent = info.title || 'Трансляція';
    streamerName.textContent = info.streamerName || 'Стрімер';
    streamerInfo.textContent = `${info.streamQuality || 'medium'} • ${info.fps || 30} FPS`;
    currentQuality.textContent = info.streamQuality || 'medium';
}

function showOffline() {
    loadingIndicator.style.display = 'none';
    offlineIndicator.style.display = 'flex';
    liveIndicator.classList.remove('live');
    liveIndicator.classList.add('offline');
    liveIndicator.querySelector('span:last-child').textContent = 'ОФЛАЙН';
}

// Stats Update
let lastStatsUpdate = Date.now();
let framesInSecond = 0;

function updateStats() {
    framesInSecond++;
    
    const now = Date.now();
    if (now - lastStatsUpdate >= 1000) {
        currentFps.textContent = framesInSecond;
        
        // Calculate latency
        const latency = now - lastFrameTime;
        currentLatency.textContent = `${latency}ms`;
        
        framesInSecond = 0;
        lastStatsUpdate = now;
    }
    
    lastFrameTime = now;
}

// Update stream duration
setInterval(() => {
    if (streamInfo && streamInfo.startTime) {
        const duration = Math.floor((Date.now() - streamInfo.startTime) / 1000);
        streamDuration.textContent = formatDuration(duration);
    }
}, 1000);

function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    
    if (h > 0) {
        return `${h}год ${m}хв`;
    } else if (m > 0) {
        return `${m}хв ${s}с`;
    } else if (s > 30) {
        return `${s}с`;
    } else {
        return 'Тільки що почався';
    }
}

// Video Controls
playPauseBtn.addEventListener('click', () => {
    isPlaying = !isPlaying;
    playPauseBtn.textContent = isPlaying ? '⏸️' : '▶️';
});

fullscreenBtn.addEventListener('click', () => {
    if (videoContainer.requestFullscreen) {
        videoContainer.requestFullscreen();
    } else if (videoContainer.webkitRequestFullscreen) {
        videoContainer.webkitRequestFullscreen();
    }
});

qualityBtn.addEventListener('click', () => {
    // TODO: Quality selection menu
    alert('Налаштування якості будуть доступні незабаром');
});

volumeBtn.addEventListener('click', () => {
    // TODO: Volume control (when audio is implemented)
    alert('Аудіо буде додано в наступній версії');
});

// Like button
let likes = 0;
let hasLiked = false;

likeBtn.addEventListener('click', () => {
    if (!hasLiked) {
        likes++;
        likeCount.textContent = likes;
        hasLiked = true;
        likeBtn.style.color = 'var(--yt-blue)';
    }
});

// Share button
shareBtn.addEventListener('click', () => {
    const url = window.location.href;
    
    if (navigator.share) {
        navigator.share({
            title: streamTitle.textContent,
            text: `Дивіться стрім на CaptureStream`,
            url: url
        });
    } else {
        navigator.clipboard.writeText(url);
        const originalText = shareBtn.querySelector('span:last-child').textContent;
        shareBtn.querySelector('span:last-child').textContent = 'Скопійовано!';
        setTimeout(() => {
            shareBtn.querySelector('span:last-child').textContent = originalText;
        }, 2000);
    }
});

// Chat (placeholder)
function addChatMessage(data) {
    const message = document.createElement('div');
    message.className = 'chat-message';
    message.innerHTML = `
        <span class="chat-author">${data.author}:</span>
        <span>${data.message}</span>
    `;
    chatMessages.appendChild(message);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && chatInput.value.trim()) {
        // TODO: Send chat message
        addChatMessage({
            author: 'Ви',
            message: chatInput.value
        });
        chatInput.value = '';
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    switch(e.key) {
        case ' ':
            e.preventDefault();
            playPauseBtn.click();
            break;
        case 'f':
        case 'F':
            fullscreenBtn.click();
            break;
    }
});

// Initialize
connectWebSocket();

// Handle visibility change (pause when tab is hidden)
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        isPlaying = false;
        playPauseBtn.textContent = '▶️';
    } else {
        isPlaying = true;
        playPauseBtn.textContent = '⏸️';
    }
});
