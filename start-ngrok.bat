@echo off
echo ================================================
echo           INFORMATOR NGROK SETUP
echo ================================================
echo.
echo 1. Отримайте ваш токен з: https://dashboard.ngrok.com/get-started/your-authtoken
echo 2. Виконайте: ngrok config add-authtoken YOUR_TOKEN_HERE
echo 3. Запустіть цей скрипт знову для створення тунелю
echo.

REM Перевіряємо чи є токен
ngrok config check >nul 2>&1
if %errorlevel% neq 0 (
    echo [ПОМИЛКА] Токен ngrok не налаштований!
    echo Виконайте: ngrok config add-authtoken YOUR_TOKEN_HERE
    pause
    exit /b 1
)

echo [OK] Токен ngrok налаштований
echo.
echo Запускаємо ngrok тунель до порту 8080...
echo Після запуску ви отримаєте URL для глобального доступу
echo.

ngrok http 8080