@echo off
echo ====================================
echo Компіляція нативного модуля захоплення екрану
echo ====================================

REM Перевірка наявності залежностей
where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ПОМИЛКА: npm не знайдено! Переконайтеся, що Node.js встановлено.
    exit /b 1
)

REM Встановлення залежностей для компіляції
echo Встановлення залежностей...
call npm install node-gyp --save-dev
call npm install bindings --save
call npm install nan --save

REM Компіляція нативного модуля
echo Компіляція модуля...
cd src
call node-gyp rebuild
if %ERRORLEVEL% NEQ 0 (
    echo ПОМИЛКА: Не вдалося скомпілювати модуль!
    exit /b 1
)

REM Копіювання модуля в директорію dist
echo Копіювання модуля...
mkdir ..\dist 2>nul
copy /Y ..\build\Release\screencapture.node ..\dist\
if %ERRORLEVEL% NEQ 0 (
    echo ПОМИЛКА: Не вдалося скопіювати модуль!
    exit /b 1
)

echo ====================================
echo Компіляція успішно завершена!
echo Модуль скопійовано в директорію dist
echo ====================================
