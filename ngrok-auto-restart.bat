@echo off
title NGROK Auto-Restart
color 0E

:START
echo ========================================================
echo              NGROK AUTO-RESTART SCRIPT
echo ========================================================
echo.
echo Час: %date% %time%
echo.

echo Перевіряю чи backend запущений...
netstat -an | findstr ":8080" >nul 2>&1
if %errorlevel% neq 0 (
    echo [ПОМИЛКА] Backend сервер не запущений на порту 8080!
    echo Спершу запустіть backend: cd backend && npm start
    echo.
    timeout /t 10
    goto START
)

echo [OK] Backend сервер працює
echo.

echo Запускаю ngrok тунель...
echo.
ngrok http 8080

echo.
echo ========================================================
echo NGROK ВІДКЛЮЧИВСЯ! Перезапуск через 5 секунд...
echo ========================================================
timeout /t 5

goto START