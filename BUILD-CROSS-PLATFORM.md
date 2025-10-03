# Build Cross-Platform - PJE Automation

Este documento explica como empacotar a aplicação PJE Automation para diferentes sistemas operacionais.

## ✅ Compatibilidade Confirmada

A aplicação foi testada e é **totalmente compatível** com:

- **Windows** (x64, ia32, arm64)
- **macOS** (Intel x64, Apple Silicon arm64)
- **Linux** (x64, AppImage)

## 🚀 Scripts de Build Disponíveis

### Scripts NPM

```bash
# Build para todas as plataformas
npm run build:cross-platform

# Build para plataformas específicas
npm run build:cross-mac      # macOS apenas
npm run build:cross-win      # Windows apenas
npm run build:cross-linux    # Linux apenas

# Limpar diretório de build
npm run build:cross-clean
```

### Script Direto

```bash
# Build para todas as plataformas
node build-cross-platform.js

# Build para plataformas específicas
node build-cross-platform.js mac
node build-cross-platform.js windows
node build-cross-platform.js linux

# Limpar diretório de build
node build-cross-platform.js clean
```

## 📦 Arquivos Gerados

Após o build, os seguintes arquivos serão criados no diretório `dist/`:

### macOS
- `PJE Perito Automation-1.0.0.dmg` (Intel x64)
- `PJE Perito Automation-1.0.0-arm64.dmg` (Apple Silicon)
- `mac/` e `mac-arm64/` (versões portáveis)

### Windows
- `win-unpacked/` (x64 portável)
- `win-ia32-unpacked/` (32-bit portável)
- `win-arm64-unpacked/` (ARM64 portável)
- `PJE Perito Automation.exe` (executável principal)

### Linux
- `PJE Perito Automation-1.0.0.AppImage` (AppImage universal)
- `linux-unpacked/` (versão portável)

## 🔧 Dependências

### Produção
- `playwright` - Automação do navegador
- `dotenv` - Gerenciamento de variáveis de ambiente
- `winston` - Sistema de logs
- `winston-daily-rotate-file` - Rotação de logs
- `lodash` - Utilitários JavaScript

### Desenvolvimento
- `electron` - Framework da aplicação
- `electron-builder` - Empacotamento cross-platform
- `jest` - Testes unitários
- `eslint` - Linting de código
- `prettier` - Formatação de código

## 🎯 Ícones

Os ícones foram configurados para cada plataforma:

- **Windows**: `assets/pje-icon.ico`
- **macOS**: `assets/pje-icon.icns`
- **Linux**: `assets/pje-icon.png`

## 🛠️ Configuração Cross-Platform

A aplicação utiliza:

1. **Detecção automática de SO** via `os.platform()`
2. **Caminhos absolutos** para compatibilidade
3. **Scripts específicos** para cada plataforma
4. **Electron Builder** com configurações otimizadas

## 📋 Requisitos do Sistema

### Para Desenvolvimento
- Node.js 18+
- npm 10+
- Git

### Para Execução
- **Windows**: Windows 10+ (x64, ia32, arm64)
- **macOS**: macOS 10.15+ (Intel ou Apple Silicon)
- **Linux**: Distribuições modernas com suporte a AppImage

## 🔍 Solução de Problemas

### Erro de NSIS no Windows
Se o instalador NSIS falhar, use a versão portável:
```bash
node build-cross-platform.js windows
```

### Erro de FPM no Linux
Se o build .deb falhar, use apenas AppImage:
```bash
npx electron-builder --linux appimage
```

### Problemas de Permissão
Certifique-se de que o script seja executável:
```bash
chmod +x build-cross-platform.js
```

## 📝 Notas Importantes

1. **Assinatura de Código**: Os builds não incluem assinatura digital (requer certificados pagos)
2. **Notarização macOS**: Não configurada (requer conta de desenvolvedor Apple)
3. **Antivírus**: Alguns antivírus podem sinalizar falsos positivos em executáveis não assinados

## 🚀 Distribuição

### Instaladores
- Use os arquivos `.dmg` para macOS
- Use os arquivos `.AppImage` para Linux
- Use as pastas `*-unpacked` para versões portáveis

### Versões Portáveis
As versões portáveis não requerem instalação e podem ser executadas diretamente:
- Windows: Execute `PJE Perito Automation.exe`
- macOS: Execute o app na pasta `mac/` ou `mac-arm64/`
- Linux: Execute o binário na pasta `linux-unpacked/`

## 📞 Suporte

Para problemas específicos de empacotamento, consulte:
- [Electron Builder Documentation](https://www.electron.build/)
- [Electron Documentation](https://www.electronjs.org/docs)