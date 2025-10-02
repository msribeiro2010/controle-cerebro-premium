#!/bin/bash

# Script para criar atalho personalizado Auto-PJe no macOS
echo "🚀 Criando atalho personalizado Auto-PJe..."

# Diretório atual do projeto
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$HOME/Desktop"
SHORTCUT_NAME="Auto-PJe"
ICON_PATH="$PROJECT_DIR/auto-pje-icon.svg"

# Converter SVG para ICNS (formato de ícone do macOS)
echo "🎨 Convertendo ícone SVG para formato macOS..."

# Criar diretório temporário para ícones
TEMP_ICON_DIR="/tmp/auto-pje-icon.iconset"
mkdir -p "$TEMP_ICON_DIR"

# Converter SVG para diferentes tamanhos PNG usando sips (built-in no macOS)
if command -v rsvg-convert >/dev/null 2>&1; then
    # Se rsvg-convert estiver disponível (via Homebrew)
    rsvg-convert -w 16 -h 16 "$ICON_PATH" > "$TEMP_ICON_DIR/icon_16x16.png"
    rsvg-convert -w 32 -h 32 "$ICON_PATH" > "$TEMP_ICON_DIR/icon_16x16@2x.png"
    rsvg-convert -w 32 -h 32 "$ICON_PATH" > "$TEMP_ICON_DIR/icon_32x32.png"
    rsvg-convert -w 64 -h 64 "$ICON_PATH" > "$TEMP_ICON_DIR/icon_32x32@2x.png"
    rsvg-convert -w 128 -h 128 "$ICON_PATH" > "$TEMP_ICON_DIR/icon_128x128.png"
    rsvg-convert -w 256 -h 256 "$ICON_PATH" > "$TEMP_ICON_DIR/icon_128x128@2x.png"
    rsvg-convert -w 256 -h 256 "$ICON_PATH" > "$TEMP_ICON_DIR/icon_256x256.png"
    rsvg-convert -w 512 -h 512 "$ICON_PATH" > "$TEMP_ICON_DIR/icon_256x256@2x.png"
    rsvg-convert -w 512 -h 512 "$ICON_PATH" > "$TEMP_ICON_DIR/icon_512x512.png"
    rsvg-convert -w 1024 -h 1024 "$ICON_PATH" > "$TEMP_ICON_DIR/icon_512x512@2x.png"
    
    # Criar arquivo ICNS
    iconutil -c icns "$TEMP_ICON_DIR" -o "$PROJECT_DIR/auto-pje-icon.icns"
    echo "✅ Ícone convertido com sucesso!"
else
    echo "⚠️  rsvg-convert não encontrado. Usando ícone padrão."
    echo "💡 Para usar ícone personalizado, instale: brew install librsvg"
fi

# Criar o atalho .command
SHORTCUT_PATH="$DESKTOP_DIR/$SHORTCUT_NAME.command"

cat > "$SHORTCUT_PATH" << 'EOF'
#!/bin/bash
echo "🚀 Iniciando Central IA - NAPJe Sistema de Automacao Inteligente..."
echo "📍 Auto-PJe - Sistema de Automação Inteligente"
echo ""

# Obter o diretório do script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Navegar para o diretório do projeto (assumindo que está no desktop)
PROJECT_DIR="/Users/marceloribeiro/Desktop/pje-perito-automation"

if [ -d "$PROJECT_DIR" ]; then
    cd "$PROJECT_DIR"
    echo "📂 Diretório: $PROJECT_DIR"
    echo ""
    
    # Verificar se o Node.js está instalado
    if command -v node >/dev/null 2>&1; then
        echo "🟢 Node.js encontrado: $(node --version)"
        echo "🟢 NPM encontrado: $(npm --version)"
        echo ""
        echo "🔄 Iniciando aplicação..."
        npm start
    else
        echo "❌ Node.js não encontrado!"
        echo "💡 Instale o Node.js em: https://nodejs.org"
        echo ""
        echo "Pressione qualquer tecla para continuar..."
        read -n 1
    fi
else
    echo "❌ Diretório do projeto não encontrado: $PROJECT_DIR"
    echo ""
    echo "Pressione qualquer tecla para continuar..."
    read -n 1
fi
EOF

# Tornar o atalho executável
chmod +x "$SHORTCUT_PATH"

# Aplicar ícone personalizado se disponível
if [ -f "$PROJECT_DIR/auto-pje-icon.icns" ]; then
    echo "🎨 Aplicando ícone personalizado..."
    
    # Usar AppleScript para definir o ícone
    osascript << EOF
tell application "Finder"
    set theFile to POSIX file "$SHORTCUT_PATH" as alias
    set theIcon to POSIX file "$PROJECT_DIR/auto-pje-icon.icns" as alias
    
    -- Ler os dados do ícone
    set iconData to read theIcon
    
    -- Aplicar o ícone ao arquivo
    set the icon of theFile to iconData
end tell
EOF
    
    if [ $? -eq 0 ]; then
        echo "✅ Ícone personalizado aplicado com sucesso!"
    else
        echo "⚠️  Não foi possível aplicar o ícone personalizado"
    fi
fi

# Limpar arquivos temporários
rm -rf "$TEMP_ICON_DIR"

echo ""
echo "🎉 Atalho 'Auto-PJe' criado com sucesso no desktop!"
echo ""
echo "📋 Para usar:"
echo "   1. Vá para o desktop"
echo "   2. Clique duas vezes no atalho 'Auto-PJe'"
echo "   3. O sistema será iniciado automaticamente"
echo ""
echo "💡 Localização: $SHORTCUT_PATH"