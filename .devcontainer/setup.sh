#!/bin/bash
# Informator Codespaces Setup Script
# Налаштування середовища для GitHub Codespaces

echo "🚀 Налаштування Informator в GitHub Codespaces..."

# Оновлення системи
echo "📦 Оновлення пакетів..."
sudo apt-get update -y

# Встановлення додаткових інструментів для C++
echo "🔧 Встановлення C++ інструментів..."
sudo apt-get install -y build-essential python3-dev

# Встановлення глобальних npm пакетів
echo "📦 Встановлення глобальних npm пакетів..."
npm install -g typescript ts-node nodemon concurrently

# Встановлення залежностей для всіх модулів
echo "📦 Встановлення залежностей проекту..."

# Backend
echo "🔧 Backend залежності..."
cd backend
npm install
cd ..

# Client (може не працювати C++ модуль в Linux)
echo "🔧 Client залежності..."
cd client
npm install || echo "⚠️  C++ модуль може не підтримуватися в Linux Codespace"
cd ..

# Windows module (основний веб сервер)
echo "🔧 Windows module залежності..."
cd windows
npm install
cd ..

# Створення конфігураційних файлів
echo "⚙️  Створення конфігурації..."

# .env для production
cat > .env << EOF
NODE_ENV=development
CODESPACES=true
PORT=8080
API_PORT=3000
WS_PORT=8888
CORS_ORIGIN=*
HOST=0.0.0.0
EOF

# Логування завершення
echo "✅ Налаштування завершено!"
echo "🌐 Готово до запуску в Codespaces"
echo ""
echo "📋 Наступні кроки:"
echo "   1. Запустіть: npm run codespaces"
echo "   2. Відкрийте порт 8080 для доступу до інтерфейсу"
echo "   3. Поділіться публічним URL!"
echo ""