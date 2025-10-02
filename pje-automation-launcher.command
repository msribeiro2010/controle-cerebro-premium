#!/bin/bash

# PJE Automation Launcher - Versão melhorada para macOS
# Este script garante que a aplicação apareça visualmente

echo "🚀 Iniciando Central IA - NAPJe Sistema de Automacao Inteligente..."
echo "📍 Diretório: $(pwd)"

# Navegar para o diretório do projeto
cd "/Users/marceloribeiro/Desktop/MESA-ICLOUD/PROJETOS_EM_ANDAMENTO/1-pje-perito-servidor-automacao-V.10"

# Verificar se o Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado. Por favor, instale o Node.js primeiro."
    echo "   Visite: https://nodejs.org/"
    read -p "Pressione Enter para sair..."
    exit 1
fi

# Verificar se o npm está instalado
if ! command -v npm &> /dev/null; then
    echo "❌ npm não encontrado. Por favor, instale o npm primeiro."
    read -p "Pressione Enter para sair..."
    exit 1
fi

# Verificar se as dependências estão instaladas
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências..."
    npm install
    
    if [ $? -ne 0 ]; then
        echo "❌ Erro ao instalar dependências."
        read -p "Pressione Enter para sair..."
        exit 1
    fi
fi

echo "✅ Verificações concluídas. Iniciando aplicação..."
echo ""

# Iniciar a aplicação em background
npm start &
APP_PID=$!

# Aguardar a aplicação inicializar
echo "⏳ Aguardando aplicação inicializar..."
sleep 3

# Tentar trazer a janela para frente usando AppleScript
echo "🔍 Tentando trazer janela para frente..."
osascript -e 'tell application "System Events" to set frontmost of first process whose name contains "Electron" to true' 2>/dev/null || true
osascript -e 'tell application "System Events" to set frontmost of first process whose name contains "PJE" to true' 2>/dev/null || true

# Aguardar o processo da aplicação
echo "✅ PJE Automation iniciado! (PID: $APP_PID)"
echo "💡 Se a janela não aparecer, verifique o Dock ou use Cmd+Tab"
echo "📴 Para fechar, use Ctrl+C ou feche a janela da aplicação"

# Aguardar o processo terminar
wait $APP_PID

echo "📴 PJE Automation foi fechado."
echo "Pressione Enter para sair..."
read