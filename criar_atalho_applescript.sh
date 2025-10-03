#!/bin/bash

# Script para criar um atalho AppleScript na área de trabalho
echo "🔧 Criando atalho AppleScript para a área de trabalho..."

# Obter o diretório atual do projeto
PROJECT_DIR="$(pwd)"
DESKTOP_DIR="$HOME/Desktop"
APP_NAME="PJE Perito Automation"
SCPT_PATH="$DESKTOP_DIR/$APP_NAME.scpt"

# Criar script AppleScript
cat > "$SCPT_PATH" << 'EOF'
on run
    try
        -- Verificar se o Node.js está instalado
        do shell script "which node"
    on error
        display dialog "Node.js não está instalado. Por favor, instale o Node.js primeiro." & return & return & "Visite: https://nodejs.org/" buttons {"OK"} default button "OK" with icon stop
        return
    end try
    
    try
        -- Navegar para o diretório do projeto e iniciar a aplicação
        do shell script "cd '/Users/marceloribeiro/Desktop/MESA-ICLOUD/PROJETOS_EM_ANDAMENTO/pje-perito-automation' && npm start > /dev/null 2>&1 &"
        
        display dialog "PJE Perito Automation foi iniciado com sucesso!" buttons {"OK"} default button "OK" with icon note giving up after 3
        
    on error errorMessage
        display dialog "Erro ao iniciar a aplicação:" & return & return & errorMessage buttons {"OK"} default button "OK" with icon stop
    end try
end run
EOF

# Compilar o AppleScript para .app
osacompile -o "$DESKTOP_DIR/$APP_NAME.app" "$SCPT_PATH"

# Remover o arquivo .scpt temporário
rm "$SCPT_PATH"

echo "✅ Atalho AppleScript criado com sucesso!"
echo "📍 Localização: $DESKTOP_DIR/$APP_NAME.app"
echo ""
echo "🎯 Para usar:"
echo "   1. Vá para a área de trabalho"
echo "   2. Clique duas vezes em '$APP_NAME.app'"
echo "   3. A aplicação será iniciada automaticamente"
echo ""
echo "💡 Dica: Você pode arrastar este atalho para o Dock para acesso rápido!"

# Abrir o Finder na área de trabalho
open "$DESKTOP_DIR"