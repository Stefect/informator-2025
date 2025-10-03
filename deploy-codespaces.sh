#!/bin/bash
# GitHub Codespaces Quick Deploy Script
# Швидке розгортання Informator в GitHub Codespaces

echo "🚀 Запуск Informator в GitHub Codespaces..."

# Встановлення залежностей
echo "📦 Встановлення залежностей..."
cd backend && npm install
cd ../client && npm install
cd ../windows && npm install
cd ..

# Перевірка середовища
echo "🔍 Перевірка середовища..."
node --version
npm --version

# Запуск серверів
echo "🌐 Запуск серверів..."

# Backend сервер
echo "🔧 Запуск backend сервера..."
cd backend
npm start &
BACKEND_PID=$!

# Повернутися до root
cd ..

# Клієнт захоплення (якщо в Linux середовищі з підтримкою)
echo "📹 Спроба запуску клієнта захоплення..."
cd client
if command -v node-gyp &> /dev/null; then
    npm run build 2>/dev/null || echo "⚠️  C++ модуль недоступний в Linux Codespace"
fi
cd ..

# Веб сервер
echo "🌐 Запуск веб сервера..."
cd windows
npm start &
WEB_PID=$!
cd ..

echo "✅ Сервери запущені!"
echo "🌍 Ваш Informator доступний на публічному URL Codespaces"
echo "📱 Порти: 3000 (backend), 8080 (websocket)"
echo ""
echo "🔗 URLs:"
echo "   - Основний інтерфейс: https://CODESPACE_NAME-8080.app.github.dev"
echo "   - API сервер: https://CODESPACE_NAME-3000.app.github.dev"
echo ""
echo "⚡ Для зупинки: Ctrl+C"

# Очікування завершення
wait