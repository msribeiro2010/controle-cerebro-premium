#!/bin/bash

# PJE Automation - Script de Inicialização
# Este script inicia o sistema PJE Automation

echo "Iniciando Central IA - NAPJe Sistema de Automacao Inteligente..."
echo "📍 Diretório: $(pwd)"

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

# Verificar se o arquivo principal existe
if [ ! -f "src/main.js" ]; then
    echo "❌ Arquivo principal não encontrado: src/main.js"
    echo "   Certifique-se de estar no diretório correto do projeto."
    read -p "Pressione Enter para sair..."
    exit 1
fi

echo "✅ Verificações concluídas. Iniciando aplicação..."
echo ""

# Iniciar a aplicação
npm start

# Se chegou até aqui, a aplicação foi fechada
echo ""
echo "📴 PJE Automation foi fechado."
read -p "Pressione Enter para sair..."