@echo off
title Informator - Global Access Launcher
color 0A

echo.
echo ================================================================
echo            INFORMATOR - GLOBAL ACCESS LAUNCHER
echo ================================================================
echo.
echo Starting all services with ngrok tunnel...
echo.

REM Start Informator Server
echo [1/3] Starting Informator Server...
start "Informator Server" cmd /k "cd /d %~dp0 && node dist/server.js"
timeout /t 3 /nobreak > nul

REM Start Capture Client
echo [2/3] Starting Capture Client...
start "Capture Client" cmd /k "cd /d %~dp0 && node dist/capture-client.js"
timeout /t 3 /nobreak > nul

REM Start ngrok Tunnel
echo [3/3] Starting ngrok Tunnel...
echo.
echo ================================================================
echo IMPORTANT: Copy the ngrok URL from the tunnel window
echo Share this URL with anyone to give them access!
echo ================================================================
echo.
start "ngrok Tunnel" cmd /k "ngrok http 3001"

timeout /t 2 /nobreak > nul

echo.
echo ================================================================
echo          ALL SERVICES STARTED SUCCESSFULLY!
echo ================================================================
echo.
echo Server:        http://localhost:3001
echo ngrok:         Check the "ngrok Tunnel" window
echo Web Monitor:   http://localhost:4040
echo.
echo To stop all services, close all windows or press Ctrl+C
echo.
pause
