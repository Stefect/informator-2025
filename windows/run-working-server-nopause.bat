@echo off
echo Запуск виправленого WebSocket сервера для трансляції відео...

cd /d "%~dp0"

echo Запуск сервера захоплення екрану...
node working-server.js
