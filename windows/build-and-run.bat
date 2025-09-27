@echo off
echo ===================================================
echo Система захоплення екрану в реальному часі
echo ===================================================

REM Перевірка залежностей
where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Помилка: npm не знайдено! Встановіть Node.js.
    pause
    exit /b 1
)

REM Встановлення необхідних пакетів
echo Встановлення залежностей...
call npm install node-addon-api nan node-gyp ws uuid --no-save

REM Компіляція нативного модуля
echo Компіляція нативного модуля...
call node-gyp rebuild
if %ERRORLEVEL% NEQ 0 (
    echo Помилка компіляції нативного модуля!
    pause
    exit /b 1
)

REM Копіювання модуля в потрібне місце
echo Копіювання модуля...
if not exist dist mkdir dist
copy /Y build\Release\screencapture.node dist\screencapture.node
if %ERRORLEVEL% NEQ 0 (
    echo Помилка копіювання модуля!
    pause
    exit /b 1
)

REM Запуск сервера та клієнта
echo Запуск сервера...
start cmd /c "node server.js"

REM Невелика затримка для запуску сервера
timeout /t 2 /nobreak >nul

REM Запуск клієнта захоплення екрану
echo Запуск клієнта захоплення екрану...
start cmd /c "node dist\app.js"

REM Відкриття веб-інтерфейсу
echo Відкриття веб-інтерфейсу...
start http://localhost:3000

echo ===================================================
echo Сервер запущено на http://localhost:3000
echo ===================================================
pause
