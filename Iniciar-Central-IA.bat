@echo off
title Central IA - NAPJe Sistema de Automacao Inteligente
color 0A

echo.
echo ========================================
echo   Central IA - NAPJe
echo   Sistema de Automacao Inteligente
echo ========================================
echo.
echo Iniciando aplicacao...
echo.

cd /d "%~dp0"

REM Verificar Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Node.js nao encontrado!
    echo Por favor, instale o Node.js: https://nodejs.org/
    pause
    exit /b 1
)

REM Verificar se node_modules existe
if not exist "node_modules" (
    echo Instalando dependencias... (primeira execucao)
    call npm install
)

REM Iniciar aplicacao
echo Abrindo Central IA - NAPJe...
start "" npm start

REM Esperar um pouco e fechar o console
timeout /t 3 >nul
exit
