@echo off
title INNOVIO v2.0 - Servidor Local
cd /d "%~dp0"

echo ============================================
echo    INNOVIO v2.0 - Servidor de Desarrollo
echo ============================================
echo.
echo    Abre manualmente: http://localhost:5173
echo    Presiona Ctrl+C para detener
echo ============================================
echo.

call npm run dev

pause
