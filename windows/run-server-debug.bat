@echo off
echo Запуск сервера захоплення екрану в режимі відладки...

cd /d "%~dp0"

echo Використовуємо модуль з папки Release...
copy /Y build\Release\gdi_screen_capture.node .

echo Запуск сервера з розширеним логуванням...
set DEBUG=*
set NODE_DEBUG=module
node --trace-warnings capture-server.js

pause
