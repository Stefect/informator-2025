#!/bin/bash
# Informator Codespaces Startup Script
# Автоматичний запуск всіх сервісів у GitHub Codespaces

echo "🚀 Запуск Informator в GitHub Codespaces..."

# Перевірка середовища
if [ ! -f .env ]; then
    echo "⚙️  Створення конфігурації..."
    cat > .env << EOF
NODE_ENV=development
CODESPACES=true
PORT=8080
API_PORT=3000
WS_PORT=8888
CORS_ORIGIN=*
HOST=0.0.0.0
EOF
fi

# Функція для чекування порту
check_port() {
    local port=$1
    local service=$2
    echo "🔍 Перевірка порту $port для $service..."
    
    # Чекаємо до 30 секунд поки порт стане доступний
    for i in {1..30}; do
        if curl -s http://localhost:$port > /dev/null 2>&1; then
            echo "✅ $service запущено на порту $port"
            return 0
        fi
        sleep 1
    done
    echo "⚠️  $service не відповідає на порту $port"
    return 1
}

# Запуск backend сервера
echo "🔧 Запуск Backend API сервера..."
cd backend
npm start > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"
cd ..

# Невелика затримка
sleep 3

# Запуск веб сервера  
echo "🌐 Запуск Web Interface сервера..."
cd windows
npm start > ../logs/web.log 2>&1 &
WEB_PID=$!
echo "Web PID: $WEB_PID"
cd ..

# Спроба запуску клієнта (може не працювати в Linux)
echo "📹 Спроба запуску Screen Capture клієнта..."
cd client
if command -v node-gyp &> /dev/null; then
    npm start > ../logs/client.log 2>&1 &
    CLIENT_PID=$!
    echo "Client PID: $CLIENT_PID"
else
    echo "⚠️  Screen Capture клієнт недоступний в Linux Codespace"
    CLIENT_PID=""
fi
cd ..

# Створення папки для логів якщо не існує
mkdir -p logs

# Чекаємо запуск сервісів
echo "⏳ Чекаємо запуск сервісів..."
sleep 5

# Перевіряємо порти
check_port 3000 "Backend API"
check_port 8080 "Web Interface"

# Інформація про доступ
echo ""
echo "✅ Informator успішно запущено в GitHub Codespaces!"
echo ""
echo "🌐 URLs для доступу:"
echo "   📱 Web Interface: https://$CODESPACE_NAME-8080.preview.app.github.dev"
echo "   🔧 Backend API:   https://$CODESPACE_NAME-3000.preview.app.github.dev"
echo ""
echo "📊 Процеси:"
echo "   Backend PID: $BACKEND_PID"
echo "   Web PID: $WEB_PID"
if [ ! -z "$CLIENT_PID" ]; then
    echo "   Client PID: $CLIENT_PID"
fi
echo ""
echo "📋 Управління:"
echo "   📄 Логи: tail -f logs/*.log"
echo "   🛑 Зупинка: pkill -f 'node.*server'"
echo "   🔄 Перезапуск: ./start-codespaces.sh"
echo ""
echo "🎯 Готово! Відкрийте Web Interface URL у новій вкладці"

# Функція для graceful shutdown
cleanup() {
    echo "🛑 Зупинка сервісів..."
    [ ! -z "$BACKEND_PID" ] && kill $BACKEND_PID 2>/dev/null
    [ ! -z "$WEB_PID" ] && kill $WEB_PID 2>/dev/null  
    [ ! -z "$CLIENT_PID" ] && kill $CLIENT_PID 2>/dev/null
    echo "✅ Сервіси зупинено"
    exit 0
}

# Обробка сигналів
trap cleanup SIGINT SIGTERM

# Тримаємо скрипт активним
echo "💡 Натисніть Ctrl+C для зупинки всіх сервісів"
wait