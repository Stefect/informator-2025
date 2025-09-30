#!/bin/bash

echo "🖥️ Запуск Informator Server..."
echo "=================================="

# Перевірка чи встановлені залежності
if [ ! -d "node_modules" ]; then
    echo "📦 Встановлення залежностей..."
    npm install
fi

# Компіляція TypeScript
echo "🔨 Компіляція TypeScript..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Компіляція успішна!"
    echo "🚀 Запуск сервера..."
    echo ""
    echo "📱 Відкрийте браузер та перейдіть на:"
    echo "   http://localhost:3001"
    echo ""
    npm start
else
    echo "❌ Помилка компіляції!"
    exit 1
fi