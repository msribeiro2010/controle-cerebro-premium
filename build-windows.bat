@echo off
REM PJE Perito Automation - Windows Build Script
REM Este script automatiza o processo de build para Windows

echo ========================================
echo PJE Perito Automation - Build Windows
echo ========================================
echo.

REM Verificar se o Node.js está instalado
node --version >nul 2>&1
if errorlevel 1 (
    echo ERRO: Node.js não encontrado!
    echo Por favor, instale o Node.js a partir de: https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js encontrado: 
node --version

REM Verificar se as dependências estão instaladas
if not exist "node_modules" (
    echo.
    echo Instalando dependências...
    npm install
    if errorlevel 1 (
        echo ERRO: Falha ao instalar dependências!
        pause
        exit /b 1
    )
)

echo.
echo Dependências verificadas/instaladas com sucesso!

REM Limpar builds anteriores
if exist "dist" (
    echo.
    echo Limpando builds anteriores...
    rmdir /s /q dist
)

echo.
echo ========================================
echo Iniciando build para Windows...
echo ========================================
echo.

REM Executar build
npm run build:win

if errorlevel 1 (
    echo.
    echo ========================================
    echo ERRO: Build falhou!
    echo ========================================
    echo Verifique os logs acima para detalhes do erro.
    pause
    exit /b 1
) else (
    echo.
    echo ========================================
    echo Build concluído com sucesso!
    echo ========================================
    echo.
    echo Arquivos gerados na pasta 'dist':
    if exist "dist" (
        dir /b dist\*.exe
    )
    echo.
    echo Para distribuir a aplicação:
    echo - Use o arquivo .exe com 'Setup' no nome para instalação
    echo - Use o arquivo 'portable.exe' para execução sem instalação
    echo.
)

echo Pressione qualquer tecla para continuar...
pause >nul