@echo off
title School Management System
color 0A

echo ========================================
echo   SCHOOL MANAGEMENT SYSTEM - STARTING
echo ========================================
echo.

start "Backend Laravel" cmd /k "cd /d %~dp0backend && php artisan serve"

timeout /t 3 /nobreak >nul

start "Frontend Next.js" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ========================================
echo   Backend       : http://localhost:8000
echo   Cong cong khai: http://localhost:3000
echo   Cong quan tri : http://localhost:3000/quan-tri
echo ========================================
echo.
echo Dang mo trinh duyet...

:: Doi frontend khoi dong xong roi moi mo trinh duyet
timeout /t 6 /nobreak >nul

start http://localhost:3000
start http://localhost:3000/quan-tri

echo.
echo Nhan phim bat ky de dong cua so nay...
pause >nul