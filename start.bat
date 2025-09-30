@echo off
chcp 65001 >nul

echo 🖥️ Запуск Informator Server...
echo ==================================

REM Перевірка чи встановлені залежності
if not exist "node_modules" (
    echo 📦 Встановлення залежностей...
    call npm install
)

REM Компіляція TypeScript
echo 🔨 Компіляція TypeScript...
call npm run build

if %errorlevel% equ 0 (
    echo ✅ Компіляція успішна!
    echo 🚀 Запуск сервера...
    echo.
    echo 📱 Відкрийте браузер та перейдіть на:
    echo    http://localhost:3001
    echo.
    call npm start
) else (
    echo ❌ Помилка компіляції!
    pause
    exit /b 1
)

pause