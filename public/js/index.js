// Index Page - Main functionality
const WS_URL = window.location.hostname === 'localhost' 
    ? 'ws://localhost:3001' 
    : `ws://${window.location.host}`;

let ws = null;
let activeStreams = [];

// DOM Elements
const menuBtn = document.getElementById('menuBtn');
const sidebar = document.getElementById('sidebar');
const mainContent = document.getElementById('mainContent');
const videoGrid = document.getElementById('videoGrid');
const noStreams = document.getElementById('noStreams');
const searchInput = document.getElementById('searchInput');

// Toggle Sidebar
menuBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    mainContent.classList.toggle('expanded');
});

// WebSocket Connection
function connectWebSocket() {
    ws = new WebSocket(WS_URL);
    
    ws.onopen = () => {
        console.log('✅ Connected to server');
        // Register as viewer to get stream list
        ws.send(JSON.stringify({
            type: 'register',
            role: 'viewer'
        }));
        requestStreamList();
    };
    
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleMessage(data);
        } catch (e) {
            console.error('Error parsing message:', e);
        }
    };
    
    ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
    };
    
    ws.onclose = () => {
        console.log('🔌 Disconnected from server');
        setTimeout(connectWebSocket, 3000);
    };
}

function handleMessage(data) {
    switch(data.type) {
        case 'streamList':
            updateStreamList(data.streams || []);
            break;
        case 'streamStarted':
            addStreamCard(data.stream);
            break;
        case 'streamEnded':
            removeStreamCard(data.streamId);
            break;
        case 'viewerCount':
            updateViewerCount(data.streamId, data.count);
            break;
    }
}

function requestStreamList() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'getStreams'
        }));
    }
}

function updateStreamList(streams) {
    activeStreams = streams;
    renderStreams();
}

function renderStreams() {
    videoGrid.innerHTML = '';
    
    if (activeStreams.length === 0) {
        videoGrid.style.display = 'none';
        noStreams.style.display = 'block';
        return;
    }
    
    videoGrid.style.display = 'grid';
    noStreams.style.display = 'none';
    
    activeStreams.forEach(stream => {
        const card = createStreamCard(stream);
        videoGrid.appendChild(card);
    });
}

function createStreamCard(stream) {
    const card = document.createElement('div');
    card.className = 'video-card';
    card.onclick = () => {
        window.location.href = `/watch.html?stream=${stream.id}`;
    };
    
    const thumbnail = stream.thumbnail || '/assets/default-thumbnail.jpg';
    const title = stream.title || `${stream.streamerName || 'Стрім'} - Трансляція`;
    const viewers = stream.viewers || 0;
    const duration = formatDuration(stream.startTime);
    
    card.innerHTML = `
        <div class="video-thumbnail">
            <img src="${thumbnail}" alt="${title}" onerror="this.src='/assets/default-thumbnail.jpg'">
            <div class="live-badge">🔴 НАЖИВО</div>
            <div class="video-duration">${viewers} глядачів</div>
        </div>
        <div class="video-info">
            <div class="video-title">${title}</div>
            <div class="video-meta">
                ${stream.streamerName || 'Стрімер'} • ${duration}
            </div>
        </div>
    `;
    
    return card;
}

function addStreamCard(stream) {
    if (!activeStreams.find(s => s.id === stream.id)) {
        activeStreams.push(stream);
        renderStreams();
    }
}

function removeStreamCard(streamId) {
    activeStreams = activeStreams.filter(s => s.id !== streamId);
    renderStreams();
}

function updateViewerCount(streamId, count) {
    const stream = activeStreams.find(s => s.id === streamId);
    if (stream) {
        stream.viewers = count;
        renderStreams();
    }
}

function formatDuration(startTime) {
    if (!startTime) return 'Тільки що почався';
    
    const now = Date.now();
    const diff = Math.floor((now - startTime) / 1000);
    
    if (diff < 60) return 'Тільки що почався';
    if (diff < 3600) return `${Math.floor(diff / 60)} хв тому`;
    
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    return `${hours}год ${minutes}хв тому`;
}

// Search functionality
searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    
    if (!query) {
        renderStreams();
        return;
    }
    
    const filtered = activeStreams.filter(stream => {
        const title = (stream.title || '').toLowerCase();
        const name = (stream.streamerName || '').toLowerCase();
        return title.includes(query) || name.includes(query);
    });
    
    videoGrid.innerHTML = '';
    
    if (filtered.length === 0) {
        videoGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: var(--yt-text-secondary);">
                Нічого не знайдено для "${e.target.value}"
            </div>
        `;
        return;
    }
    
    filtered.forEach(stream => {
        const card = createStreamCard(stream);
        videoGrid.appendChild(card);
    });
});

// Initialize
connectWebSocket();

// Periodic stream list refresh
setInterval(requestStreamList, 10000);
