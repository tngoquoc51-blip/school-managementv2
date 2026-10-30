@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo   SCHOOL MANAGEMENT SYSTEM - STARTING
echo ========================================
echo.

:: Backend
start "SMS-Backend" cmd /k "cd /d "%~dp0backend" && php artisan serve --host=127.0.0.1 --port=8000"

:: Frontend
start "SMS-Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo Backend  : http://127.0.0.1:8000
echo Frontend : http://localhost:3000
echo Admin    : http://localhost:3000/login/admin
echo.
echo Dang cho server khoi dong (12 giay)...
timeout /t 12 /nobreak >nul

:: Mo Chrome (doi path neu may ban khac)
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" "http://localhost:3000" "http://localhost:3000/login/admin"

echo.
echo Neu trinh duyet khong mo, hay tu go:
echo   http://localhost:3000
echo.
pause