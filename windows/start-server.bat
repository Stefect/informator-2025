@echo off
echo Starting WebSocket Server...

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Error: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Start the server
cd /d "D:\Нова папка\windows"
node server.js
echo WebSocket Server stopped. 