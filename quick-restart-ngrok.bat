@echo off
title Швидкий перезапуск ngrok
color 0A

echo ========================================================
echo          ШВИДКИЙ ПЕРЕЗАПУСК NGROK ТУНЕЛЮ
echo ========================================================
echo.

echo Зупиняю старі процеси ngrok...
taskkill /f /im ngrok.exe >nul 2>&1

timeout /t 2 /nobreak >nul

echo Перевіряю backend сервер...
netstat -an | findstr ":8080" >nul 2>&1
if %errorlevel% neq 0 (
    echo [ПОМИЛКА] Backend не працює на порту 8080!
    echo Спершу запустіть backend: cd backend && npm start
    pause
    exit /b 1
)

echo [OK] Backend працює
echo.

echo Запускаю новий ngrok тунель...
echo.
echo ========================================================
echo           НОВИЙ URL БУДЕ ПОКАЗАНИЙ НИЖЧЕ:
echo ========================================================
echo.

ngrok http 8080