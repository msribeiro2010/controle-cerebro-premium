#!/bin/bash

# Script para criar um atalho na área de trabalho do macOS
# Este script cria um arquivo .app que pode ser usado como atalho

echo "🔧 Criando atalho para a área de trabalho..."

# Obter o diretório atual do projeto
PROJECT_DIR="$(pwd)"
DESKTOP_DIR="$HOME/Desktop"
APP_NAME="PJE Perito Automation"
APP_PATH="$DESKTOP_DIR/$APP_NAME.app"

# Criar estrutura do .app
mkdir -p "$APP_PATH/Contents/MacOS"
mkdir -p "$APP_PATH/Contents/Resources"

# Criar Info.plist
cat > "$APP_PATH/Contents/Info.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>PJE Perito Automation</string>
    <key>CFBundleIdentifier</key>
    <string>com.pje.perito.automation</string>
    <key>CFBundleName</key>
    <string>PJE Perito Automation</string>
    <key>CFBundleVersion</key>
    <string>1.0</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleSignature</key>
    <string>????</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.9</string>
    <key>CFBundleIconFile</key>
    <string>icon</string>
</dict>
</plist>
EOF

# Criar script executável
cat > "$APP_PATH/Contents/MacOS/PJE Perito Automation" << 'EOF'
#!/bin/bash

# Navegar para o diretório do projeto
cd "/Users/marceloribeiro/Desktop/MESA-ICLOUD/PROJETOS_EM_ANDAMENTO/pje-perito-automation"

# Verificar se o Node.js está instalado
if ! command -v node &> /dev/null; then
    osascript -e 'display dialog "Node.js não está instalado. Por favor, instale o Node.js primeiro.\n\nVisite: https://nodejs.org/" buttons {"OK"} default button "OK" with icon stop'
    exit 1
fi

# Verificar se as dependências estão instaladas
if [ ! -d "node_modules" ]; then
    osascript -e 'display dialog "Instalando dependências..." buttons {"OK"} default button "OK" with icon note'
    npm install
    if [ $? -ne 0 ]; then
        osascript -e 'display dialog "Erro ao instalar dependências." buttons {"OK"} default button "OK" with icon stop'
        exit 1
    fi
fi

# Iniciar a aplicação
npm start
EOF

# Tornar o script executável
chmod +x "$APP_PATH/Contents/MacOS/PJE Perito Automation"

# Copiar ícone se existir
if [ -f "assets/icon.svg" ]; then
    # Converter SVG para ICNS seria complexo, então vamos usar um ícone padrão
    echo "📁 Ícone SVG encontrado, mas será usado ícone padrão do sistema"
fi

echo "✅ Atalho criado com sucesso!"
echo "📍 Localização: $APP_PATH"
echo ""
echo "🎯 Para usar:"
echo "   1. Vá para a área de trabalho"
echo "   2. Clique duas vezes em '$APP_NAME.app'"
echo "   3. A aplicação será iniciada automaticamente"
echo ""
echo "💡 Dica: Você pode arrastar este atalho para o Dock para acesso rápido!"

# Abrir o Finder na área de trabalho para mostrar o atalho criado
open "$DESKTOP_DIR"