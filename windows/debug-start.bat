@echo off
echo Запуск сервера захоплення екрану в режимі налагодження...
echo.

set NODE_OPTIONS=--trace-warnings --unhandled-rejections=strict

node --trace-uncaught --inspect capture-server.js

echo.
if %ERRORLEVEL% NEQ 0 (
    echo Сервер завершився з помилкою, код: %ERRORLEVEL%
    pause
) else (
    echo Сервер завершився успішно
)
