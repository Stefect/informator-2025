@echo off
echo ====================================
echo Підготовка до запуску захоплення екрану...
echo ====================================

REM Перевірка наявності директорії dist
if not exist "dist" mkdir dist

REM Перевірка наявності нативного модуля
if not exist "build\Release\screencapture.node" (
    echo ПОМИЛКА: Не знайдено модуль screencapture.node!
    echo Перевірте, чи скомпільований модуль у директорії build\Release
    pause
    exit /b 1
)

REM Копіювання необхідних файлів
echo Копіювання необхідних файлів...
xcopy /Y /I "build\Release\screencapture.node" "dist\"
if exist "node_modules\sharp\build\Release\sharp-win32-x64.node" xcopy /Y /I "node_modules\sharp\build\Release\sharp-win32-x64.node" "dist\"
if exist "node_modules\electron\dist\*.dll" xcopy /Y /I "node_modules\electron\dist\*.dll" "dist\"
xcopy /Y /I "config.json" "dist\"
xcopy /Y /I "index.html" "dist\"

REM Перевірка наявності app.js
if not exist "dist\app.js" (
    echo ПОМИЛКА: Не знайдено файл app.js у директорії dist!
    echo Перевірте, чи компіляція TypeScript пройшла успішно
    pause
    exit /b 1
)

REM Перевірка наявності screen-capture.js
if not exist "dist\screen-capture.js" (
    echo ПОМИЛКА: Не знайдено файл screen-capture.js у директорії dist!
    echo Перевірте, чи компіляція TypeScript пройшла успішно
    pause
    exit /b 1
)

REM Запуск серверу і клієнта в окремих вікнах
echo Запуск WebSocket серверу...
start "WebSocket Server" cmd /c "node server.js"

REM Чекаємо 2 секунди, щоб сервер запустився
timeout /t 2 /nobreak

echo Запуск клієнта захоплення екрану...
start "Screen Capture Client" cmd /c "cd dist && node app.js"

echo Відкриття інтерфейсу в браузері...
timeout /t 2 /nobreak
start http://localhost:3000

echo ====================================
echo Система запущена!
echo * Сервер: http://localhost:3000
echo * Клієнт захоплення екрану: запущено
echo ====================================
echo Для завершення роботи закрийте всі відкриті вікна
echo або натисніть Ctrl+C в кожному з них.

REM Cleanup
cd ..
if exist "dist\screencapture.node" del "dist\screencapture.node"
if exist "dist\sharp-win32-x64.node" del "dist\sharp-win32-x64.node"
if exist "dist\*.dll" del "dist\*.dll"
if exist "dist\config.json" del "dist\config.json"
if exist "dist\index.html" del "dist\index.html"