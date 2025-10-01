@echo off
echo.
echo ===================================================
echo         🖥️  INFORMATOR - Competition Ready  🖥️
echo ===================================================
echo.
echo 🔧 Building native module...
call npm run build:native
if errorlevel 1 (
    echo ❌ Native build failed!
    pause
    exit /b 1
)

echo.
echo 🔧 Building TypeScript...
call npm run build
if errorlevel 1 (
    echo ❌ TypeScript build failed!
    pause
    exit /b 1
)

echo.
echo 🚀 Starting Informator Server...
echo.
echo 📱 Web Interface: http://localhost:3001
echo 🔌 WebSocket: ws://localhost:3001  
echo 📊 API: http://localhost:3001/api/status
echo.
echo 💡 To start capture: Open another terminal and run:
echo    node dist/capture-client.js
echo.
pause

call npm start