@echo off
title PJE Automation - Peritos e Servidores

echo.
echo ========================================
echo   PJE Automation - Peritos e Servidores
echo ========================================
echo.
echo 🚀 Iniciando Central IA - NAPJe Sistema de Automacao Inteligente...
echo 📍 Diretorio: %CD%
echo.

REM Verificar se o Node.js está instalado
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js nao encontrado. Por favor, instale o Node.js primeiro.
    echo    Visite: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM Verificar se o npm está instalado
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm nao encontrado. Por favor, instale o npm primeiro.
    echo.
    pause
    exit /b 1
)

REM Verificar se as dependências estão instaladas
if not exist "node_modules" (
    echo 📦 Instalando dependencias...
    echo    Isso pode demorar alguns minutos na primeira execucao...
    echo.
    npm install
    
    if %errorlevel% neq 0 (
        echo ❌ Erro ao instalar dependencias.
        echo.
        pause
        exit /b 1
    )
    echo ✅ Dependencias instaladas com sucesso!
    echo.
)

REM Verificar se o arquivo principal existe
if not exist "src\main.js" (
    echo ❌ Arquivo principal nao encontrado: src\main.js
    echo    Certifique-se de estar no diretorio correto do projeto.
    echo.
    pause
    exit /b 1
)

echo ✅ Verificacoes concluidas. Iniciando aplicacao...
echo.
echo 💡 Dica: Para fechar o sistema, feche a janela da aplicacao
echo          ou pressione Ctrl+C neste terminal.
echo.

REM Iniciar a aplicação
npm start

REM Se chegou até aqui, a aplicação foi fechada
echo.
echo 📴 PJE Automation foi fechado.
echo.
pause