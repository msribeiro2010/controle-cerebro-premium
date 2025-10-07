#!/bin/bash

# Script de atalho para PJE Perito Automation
# Este arquivo pode ser copiado para a área de trabalho

# Navegar para o diretório do projeto
cd "/Users/marceloribeiro/Desktop/MESA-ICLOUD/PROJETOS_EM_ANDAMENTO/pje-perito-automation"

# Verificar se o Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não está instalado. Por favor, instale o Node.js primeiro."
    echo "Visite: https://nodejs.org/"
    read -p "Pressione Enter para fechar..."
    exit 1
fi

# Verificar se o npm está instalado
if ! command -v npm &> /dev/null; then
    echo "❌ npm não está instalado. Por favor, instale o npm primeiro."
    read -p "Pressione Enter para fechar..."
    exit 1
fi

# Verificar se as dependências estão instaladas
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Erro ao instalar dependências."
        read -p "Pressione Enter para fechar..."
        exit 1
    fi
fi

echo "🚀 Iniciando PJE Perito Automation..."
echo "📁 Diretório: $(pwd)"
echo ""

# Iniciar a aplicação
npm start

# Manter o terminal aberto se houver erro
if [ $? -ne 0 ]; then
    echo ""
    echo "❌ A aplicação foi encerrada com erro."
    read -p "Pressione Enter para fechar..."
fi