@echo off
title Informator 2025 - Глобальний доступ
echo ================================================
echo           INFORMATOR 2025 LAUNCHER
echo ================================================
echo.

REM Перевіряємо чи запущений backend
netstat -an | findstr ":8080" >nul 2>&1
if %errorlevel% neq 0 (
    echo [УВАГА] Backend сервер не запущений на порту 8080
    echo Спершу запустіть backend сервер:
    echo   cd backend
    echo   npm start
    echo.
    pause
    exit /b 1
)

echo [OK] Backend сервер запущений на порту 8080
echo.

REM Перевіряємо ngrok токен
ngrok config check >nul 2>&1
if %errorlevel% neq 0 (
    echo [ПОМИЛКА] Токен ngrok не налаштований!
    echo.
    echo 1. Перейдіть на: https://dashboard.ngrok.com/get-started/your-authtoken
    echo 2. Скопіюйте ваш токен
    echo 3. Виконайте: ngrok config add-authtoken YOUR_TOKEN
    echo.
    pause
    exit /b 1
)

echo [OK] Токен ngrok налаштований
echo.

echo ================================================
echo              ДОСТУПНІ АДРЕСИ:
echo ================================================
echo Локальний доступ:     http://localhost:8080
echo Мережевий доступ:     http://192.168.1.101:8080
echo Глобальний доступ:    (буде показано після запуску ngrok)
echo.
echo Пароль для входу:     informator2025
echo.
echo ================================================

echo Запускаю ngrok тунель...
ngrok http 8080