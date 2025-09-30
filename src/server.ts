import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import path from 'path';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3001;

// Статичні файли
app.use(express.static(path.join(__dirname, '..')));

// Головна сторінка
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// WebSocket з'єднання
const connectedClients = new Set<WebSocket>();

wss.on('connection', (ws, req) => {
    const clientIP = req.socket.remoteAddress || 'unknown';
    console.log(`[Server] Нове підключення від ${clientIP}`);
    
    connectedClients.add(ws);

    // Відправка тестового повідомлення
    ws.send(JSON.stringify({
        type: 'connected',
        message: 'Підключено до сервера Informator',
        timestamp: new Date().toISOString()
    }));

    // Обробка повідомлень від клієнта
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            console.log(`[Server] Отримано повідомлення:`, message.type);
            
            switch (message.type) {
                case 'ping':
                    ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
                    break;
                    
                case 'screen_data':
                    // Передача скріншоту іншим клієнтам
                    broadcastToClients(data, ws);
                    break;
                    
                default:
                    console.log(`[Server] Невідомий тип повідомлення: ${message.type}`);
            }
        } catch (error) {
            console.error('[Server] Помилка обробки повідомлення:', error);
        }
    });

    // Обробка відключення
    ws.on('close', () => {
        connectedClients.delete(ws);
        console.log(`[Server] Клієнт відключився. Залишилось: ${connectedClients.size}`);
    });

    // Обробка помилок
    ws.on('error', (error) => {
        console.error('[Server] Помилка WebSocket:', error);
        connectedClients.delete(ws);
    });
});

// Функція для розсилки даних всім клієнтам
function broadcastToClients(data: any, sender?: WebSocket) {
    connectedClients.forEach((client) => {
        if (client !== sender && client.readyState === WebSocket.OPEN) {
            try {
                client.send(data);
            } catch (error) {
                console.error('[Server] Помилка відправки даних клієнту:', error);
                connectedClients.delete(client);
            }
        }
    });
}

// Запуск сервера
server.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════╗
║         🖥️  INFORMATOR SERVER        ║
║                                      ║
║  Server running on: http://localhost:${PORT}  ║
║  WebSocket: ws://localhost:${PORT}           ║
║                                      ║
║  📊 Status: READY                    ║
║  🔗 Connections: 0                   ║
╚══════════════════════════════════════╝
    `);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n[Server] Отримано сигнал SIGINT. Завершення роботи...');
    
    // Закрити всі WebSocket з'єднання
    connectedClients.forEach((ws) => {
        ws.close(1000, 'Server shutdown');
    });
    
    server.close(() => {
        console.log('[Server] Сервер зупинено');
        process.exit(0);
    });
});

export default app;