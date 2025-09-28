@echo off
title INFORMATOR 2025 - Startup Script
color 0A

echo ========================================================
echo              INFORMATOR 2025 LAUNCHER  
echo ========================================================
echo.

echo [1/4] Запуск Backend сервера...
start "Backend Server" cmd /k "cd /d "%~dp0backend" && npm start"

timeout /t 3 /nobreak >nul

echo [2/4] Компіляція клієнта...
cd /d "%~dp0client"
npx tsc src/client.ts --outDir dist --esModuleInterop --target es2020 --module commonjs --skipLibCheck

echo [3/4] Запуск клієнта захоплення екрану...
start "Screen Capture Client" cmd /k "cd /d "%~dp0client" && node dist\client.js"

timeout /t 2 /nobreak >nul

echo [4/4] Запуск ngrok тунелю...
start "Ngrok Tunnel" cmd /k "ngrok http 8080"

timeout /t 3 /nobreak >nul

echo.
echo ========================================================
echo                СИСТЕМА ЗАПУЩЕНА!
echo ========================================================
echo.
echo Локальний доступ:    http://localhost:8080
echo Мережевий доступ:    http://192.168.1.101:8080  
echo Глобальний доступ:   Дивіться в вікні ngrok
echo.
echo Пароль:              informator2025
echo.
echo ========================================================

echo Відкриваю веб-інтерфейс...
start http://localhost:8080

echo.
echo Натисніть будь-яку клавішу для закриття...
pause >nul