@echo off
echo Запуск WebSocket сервера для трансляції відео...

cd /d "%~dp0"

echo Встановлення залежностей...
npm install

echo Компіляція нативного модуля...
call node-gyp clean
call node-gyp configure
call node-gyp build

echo Запуск сервера захоплення екрану з режимом відладки...
set DEBUG=*
node capture-server.js

pause
