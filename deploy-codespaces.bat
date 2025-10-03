@echo off
:: GitHub Codespaces Windows Deploy Script
:: Розгортання Informator в Windows Codespaces середовищі

echo 🚀 Запуск Informator в GitHub Codespaces...

:: Встановлення залежностей
echo 📦 Встановлення залежностей...
cd backend
call npm install
cd ..\client
call npm install
cd ..\windows  
call npm install
cd ..

:: Перевірка середовища
echo 🔍 Перевірка середовища...
node --version
npm --version

:: Створення конфігураційного файлу для Codespaces
echo 🔧 Створення конфігурації для Codespaces...
echo NODE_ENV=production > .env
echo CODESPACES=true >> .env
echo PORT=8080 >> .env

:: Запуск backend сервера
echo 🌐 Запуск backend сервера...
cd backend
start /B npm start
cd ..

:: Невелика затримка
timeout /t 3 /nobreak >nul

:: Запуск основного веб сервера
echo 🌐 Запуск веб сервера...
cd windows
start /B npm start
cd ..

echo ✅ Сервери запущені!
echo 🌍 Ваш Informator доступний на публічному URL Codespaces
echo 📱 Порти: 3000 (backend), 8080 (websocket)
echo.
echo 🔗 URLs (замініть CODESPACE_NAME на ваше ім'я):
echo    - Основний інтерфейс: https://CODESPACE_NAME-8080.app.github.dev
echo    - API сервер: https://CODESPACE_NAME-3000.app.github.dev
echo.
echo 📋 Для знаходження вашого CODESPACE_NAME:
echo    - Дивіться URL браузера або
echo    - Перевірте змінну CODESPACE_NAME
echo.
echo ⚡ Натисніть будь-яку клавішу для виходу...
pause >nul