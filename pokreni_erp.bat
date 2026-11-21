@echo off
chcp 65001 >nul
title Pilana ERP — Pokretanje Aplikacije
echo ============================================================
echo   PILANA ERP — Priprema i pokretanje na http://localhost:3000
echo ============================================================
echo.

if not exist "node_modules" (
    echo [1/2] Instaliram pakete (prvo pokretanje)...
    call npm install
    if errorlevel 1 (
        echo GRESKA pri npm install! Provjerite da je Node.js instaliran.
        pause
        exit /b 1
    )
)

echo [2/2] Pokrecem Pilana ERP server...
echo Aplikacija ce se uskoro otvoriti u pregledniku na: http://localhost:3000
echo (Za zaustavljanje pritisnite CTRL + C)
echo.

start "" cmd /c "timeout /t 4 /nobreak >nul && start http://localhost:3000"
call npm run dev
pause
