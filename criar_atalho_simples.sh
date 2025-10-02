#!/bin/bash

# Script para criar um atalho simples e funcional
echo "🔧 Criando atalho simples para a área de trabalho..."

# Remover atalho anterior se existir
rm -rf ~/Desktop/"PJE Perito Automation.app"

# Criar um script shell simples na área de trabalho
cat > ~/Desktop/"Iniciar PJE Perito.command" << 'EOF'
#!/bin/bash

# Mostrar janela de terminal
printf "\033]0;PJE Perito Automation\007"
clear

echo "🚀 PJE Perito Automation"
echo "========================"
echo ""

# Navegar para o diretório do projeto
cd "/Users/marceloribeiro/Desktop/MESA-ICLOUD/PROJETOS_EM_ANDAMENTO/pje-perito-automation"

# Verificar se o Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não está instalado."
    echo "Por favor, instale o Node.js em: https://nodejs.org/"
    echo ""
    read -p "Pressione Enter para fechar..."
    exit 1
fi

echo "✅ Node.js encontrado: $(node --version)"
echo "✅ npm encontrado: $(npm --version)"
echo ""

# Verificar se as dependências estão instaladas
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Erro ao instalar dependências."
        read -p "Pressione Enter para fechar..."
        exit 1
    fi
    echo "✅ Dependências instaladas com sucesso!"
    echo ""
fi

echo "🚀 Iniciando aplicação..."
echo "📁 Diretório: $(pwd)"
echo ""
echo "💡 Para fechar a aplicação, pressione Ctrl+C neste terminal"
echo ""

# Iniciar a aplicação
npm start

# Se chegou aqui, a aplicação foi fechada
echo ""
echo "📝 Aplicação encerrada."
read -p "Pressione Enter para fechar este terminal..."
EOF

# Tornar executável
chmod +x ~/Desktop/"Iniciar PJE Perito.command"

echo "✅ Atalho criado com sucesso!"
echo "📍 Localização: ~/Desktop/Iniciar PJE Perito.command"
echo ""
echo "🎯 Para usar:"
echo "   1. Vá para a área de trabalho"
echo "   2. Clique duas vezes em 'Iniciar PJE Perito.command'"
echo "   3. A aplicação será iniciada no terminal"
echo ""
echo "💡 Este atalho é mais simples e confiável!"

# Abrir o Finder na área de trabalho
open ~/Desktop