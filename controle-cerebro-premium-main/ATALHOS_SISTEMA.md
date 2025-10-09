# 🚀 Atalhos para Iniciar o PJE Automation

Este documento explica como criar e usar atalhos para iniciar o sistema PJE Automation de forma rápida e fácil.

## 📋 Opções Disponíveis

### 🔧 **Opção 1: Criar Atalho Automaticamente**

Execute este comando no terminal/prompt:

```bash
npm run create-shortcut
```

**O que acontece:**
- ✅ Cria um atalho no desktop automaticamente
- ✅ Funciona em Windows, macOS e Linux
- ✅ Ícone personalizado incluído
- ✅ Pronto para usar!

### 🖱️ **Opção 2: Scripts Manuais**

#### **Windows:**
- Clique duas vezes em: `start.bat`
- Ou execute no prompt: `start.bat`

#### **macOS/Linux:**
- Execute no terminal: `./start.sh`
- Ou torne executável e clique: `chmod +x start.sh && ./start.sh`

### ⚡ **Opção 3: Comando NPM**

```bash
npm start
```

## 🎯 **Instalação Completa (Recomendado)**

Para configurar tudo de uma vez:

```bash
npm run setup
```

**Este comando:**
1. 📦 Instala todas as dependências
2. 🔗 Cria atalho no desktop
3. ✅ Deixa tudo pronto para usar

## 📱 **Como Usar os Atalhos**

### **Windows:**
1. Vá para o desktop
2. Clique duas vezes em "PJE Automation.bat"
3. Uma janela do terminal abrirá
4. O sistema iniciará automaticamente

### **macOS:**
1. Vá para o desktop
2. Clique duas vezes em "PJE Automation.command"
3. O Terminal abrirá e iniciará o sistema
4. (Pode pedir permissão na primeira vez)

### **Linux:**
1. Vá para o desktop
2. Clique duas vezes em "PJE-Automation.desktop"
3. Escolha "Executar" se perguntado
4. O sistema iniciará no terminal

## 🔍 **Verificações Automáticas**

Os scripts fazem verificações automáticas:

- ✅ **Node.js instalado** - Verifica se está disponível
- ✅ **NPM funcionando** - Confirma que pode instalar pacotes
- ✅ **Dependências** - Instala automaticamente se necessário
- ✅ **Arquivos do projeto** - Verifica se estão no lugar certo
- ✅ **Feedback visual** - Mostra o progresso de cada etapa

## 🛠️ **Solução de Problemas**

### **"Node.js não encontrado"**
```bash
# Instale o Node.js de: https://nodejs.org/
# Ou use um gerenciador de pacotes:

# macOS (Homebrew)
brew install node

# Ubuntu/Debian
sudo apt install nodejs npm

# Windows (Chocolatey)
choco install nodejs
```

### **"Erro ao instalar dependências"**
```bash
# Limpe o cache e tente novamente
npm cache clean --force
rm -rf node_modules
npm install
```

### **"Arquivo principal não encontrado"**
- Certifique-se de estar no diretório correto do projeto
- Verifique se o arquivo `src/main.js` existe

### **Atalho não funciona**
```bash
# Recrie o atalho
npm run create-shortcut

# Ou execute manualmente
npm start
```

## 📂 **Estrutura dos Arquivos**

```
pje-perito-automation/
├── start.sh              # Script para macOS/Linux
├── start.bat             # Script para Windows
├── create-shortcut.js    # Gerador de atalhos
├── assets/
│   └── pje-icon.svg      # Ícone do sistema
└── Desktop/              # Atalhos criados aqui
    ├── PJE Automation.bat        (Windows)
    ├── PJE Automation.command    (macOS)
    └── PJE-Automation.desktop    (Linux)
```

## 🎨 **Personalização**

### **Mudar o Ícone:**
- Edite: `assets/pje-icon.svg`
- Ou substitua por um arquivo `.ico` (Windows) ou `.icns` (macOS)

### **Mudar o Nome:**
- Edite a variável `projectName` em `create-shortcut.js`
- Execute `npm run create-shortcut` novamente

### **Adicionar Parâmetros:**
- Edite os scripts `start.sh` ou `start.bat`
- Adicione flags como `--dev` para modo desenvolvimento

## 🚀 **Comandos Rápidos**

```bash
# Instalar e configurar tudo
npm run setup

# Apenas criar atalho
npm run create-shortcut

# Iniciar sistema
npm start

# Modo desenvolvimento
npm run dev

# Verificar sintaxe
npm run syntax-check
```

## 💡 **Dicas**

1. **Primeira execução**: Pode demorar mais para instalar dependências
2. **Atualizações**: Execute `npm run setup` após atualizações
3. **Múltiplos atalhos**: Pode criar quantos quiser
4. **Backup**: Os scripts são seguros e não modificam arquivos do sistema
5. **Portabilidade**: Funciona em qualquer máquina com Node.js

## 🎉 **Pronto!**

Agora você tem várias formas fáceis de iniciar o PJE Automation:

- 🖱️ **Clique duplo** no atalho do desktop
- ⌨️ **Comando rápido** `npm start`
- 📱 **Scripts dedicados** para cada sistema operacional

O sistema está pronto para uso! 🚀