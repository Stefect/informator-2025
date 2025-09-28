@echo off
title Налаштування ngrok токена
color 0A
echo ========================================================
echo                  НАЛАШТУВАННЯ NGROK
echo ========================================================
echo.
echo 1. Перейдіть на: https://dashboard.ngrok.com/get-started/your-authtoken
echo 2. Увійдіть в ваш акаунт ngrok
echo 3. Скопіюйте токен (виглядає як: 2p9Y7abc123def456...)
echo.
echo ========================================================
echo.
set /p "token=Вставте ваш токен ngrok сюди: "

if "%token%"=="" (
    echo [ПОМИЛКА] Токен не може бути порожнім!
    pause
    exit /b 1
)

if "%token%"=="YOUR_TOKEN_HERE" (
    echo [ПОМИЛКА] Це тестовий токен! Вставте справжній токен з dashboard.
    pause
    exit /b 1
)

echo.
echo Налаштовую токен...
ngrok config add-authtoken %token%

if %errorlevel% equ 0 (
    echo [OK] Токен успішно налаштований!
    echo.
    echo Запускаю ngrok тунель...
    echo.
    ngrok http 8080
) else (
    echo [ПОМИЛКА] Не вдалося налаштувати токен. Перевірте правильність токена.
    pause
)

pause