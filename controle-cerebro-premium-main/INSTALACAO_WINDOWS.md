# 🪟 Guia de Instalação - Windows (Sem Privilégios de Administrador)

Este guia explica como instalar e usar o **Central IA - NAPJe** em máquinas Windows onde você **não possui privilégios de administrador**.

---

## 📋 Índice

1. [Opções de Instalação](#-opções-de-instalação)
2. [Opção 1: Versão Portable (RECOMENDADA)](#-opção-1-versão-portable-recomendada)
3. [Opção 2: Versão ZIP](#-opção-2-versão-zip)
4. [Opção 3: Instalador NSIS](#-opção-3-instalador-nsis-modo-usuário)
5. [Solução de Problemas](#-solução-de-problemas)
6. [Perguntas Frequentes](#-perguntas-frequentes)

---

## 🎯 Opções de Instalação

O Central IA - NAPJe oferece **3 opções** para instalação sem privilégios administrativos:

| Opção | Arquivo | Requer Admin? | Instalação | Uso |
|-------|---------|---------------|------------|-----|
| **Portable** | `Central IA - NAPJe-1.0.0-portable.exe` | ❌ Não | Copiar arquivo | Executar direto |
| **ZIP** | `Central IA - NAPJe-1.0.0-win-x64.zip` | ❌ Não | Extrair ZIP | Executar .exe |
| **NSIS (Usuário)** | `Central IA - NAPJe-1.0.0-win-x64.exe` | ❌ Não* | Instalar pasta usuário | Menu Iniciar |

\* *Desde que instalado em pasta do usuário (ex: `%LOCALAPPDATA%`)*

---

## ✨ Opção 1: Versão Portable (RECOMENDADA)

### 📥 Download
Baixe o arquivo **portable**:
```
Central IA - NAPJe-1.0.0-portable.exe
```

### 📂 Instalação

1. **Copie o arquivo** para qualquer pasta onde você tem permissão de escrita:
   - ✅ `C:\Users\SeuUsuario\Desktop\CentralIA`
   - ✅ `C:\Users\SeuUsuario\Documents\CentralIA`
   - ✅ `D:\MeusProgramas\CentralIA` (se tiver acesso)
   - ✅ Pendrive ou HD externo

2. **Execute o arquivo**:
   - Duplo clique em `Central IA - NAPJe-1.0.0-portable.exe`
   - O aplicativo abrirá imediatamente
   - ✅ **Nenhuma instalação necessária!**

### 🎯 Vantagens

- ✅ Não requer privilégios administrativos
- ✅ Pode ser executado de pendrive/HD externo
- ✅ Não deixa rastros no sistema
- ✅ Fácil de remover (apenas delete o arquivo)
- ✅ Pode ter múltiplas versões em pastas diferentes

### 📝 Criando Atalho (Opcional)

Para criar um atalho na área de trabalho:

1. **Clique com botão direito** no arquivo `.exe`
2. Selecione **"Criar atalho"**
3. Arraste o atalho para a **Área de Trabalho**

---

## 📦 Opção 2: Versão ZIP

### 📥 Download
Baixe o arquivo **ZIP**:
```
Central IA - NAPJe-1.0.0-win-x64.zip
```

### 📂 Instalação

1. **Extraia o ZIP** em uma pasta de sua escolha:
   ```
   Clique com botão direito → Extrair Tudo...
   ```

   Escolha um destino onde você tem permissão:
   - `C:\Users\SeuUsuario\CentralIA`
   - `D:\MeusProgramas\CentralIA`

2. **Abra a pasta extraída**:
   ```
   CentralIA/
   ├── Central IA - NAPJe.exe  ← Execute este arquivo
   ├── resources/
   ├── locales/
   └── ...outros arquivos...
   ```

3. **Execute o aplicativo**:
   - Duplo clique em `Central IA - NAPJe.exe`

### 🎯 Vantagens

- ✅ Não requer privilégios administrativos
- ✅ Vê todos os arquivos da aplicação
- ✅ Fácil de fazer backup (copiar pasta inteira)
- ✅ Pode ser movido entre computadores

---

## 🔧 Opção 3: Instalador NSIS (Modo Usuário)

### 📥 Download
Baixe o instalador **NSIS**:
```
Central IA - NAPJe-1.0.0-win-x64.exe  (Instalador)
```

### 📂 Instalação

1. **Execute o instalador**:
   - Duplo clique no arquivo
   - Se aparecer aviso de segurança, clique **"Mais informações" → "Executar assim mesmo"**

2. **Durante a instalação**:

   ⚠️ **IMPORTANTE**: Quando perguntar o local de instalação:

   ❌ **NÃO use**: `C:\Program Files\` (requer admin)

   ✅ **USE**:
   ```
   C:\Users\SeuUsuario\AppData\Local\Central-IA-NAPJe
   ```
   ou
   ```
   C:\Users\SeuUsuario\CentralIA
   ```

3. **Complete a instalação**:
   - Marque opção **"Criar atalho na área de trabalho"**
   - Clique em **"Instalar"**
   - ✅ Instalação concluída sem pedir senha de admin!

### 🎯 Vantagens

- ✅ Integração com Menu Iniciar
- ✅ Atalhos automáticos
- ✅ Desinstalador integrado
- ✅ Atualizações mais fáceis

---

## ❗ Solução de Problemas

### Problema: "Este aplicativo requer privilégios de administrador"

**Solução**:
1. Você está usando o **Instalador NSIS**
2. Escolha pasta do usuário durante instalação (ex: `C:\Users\SeuUsuario\CentralIA`)
3. **OU** use a **Versão Portable** ao invés

---

### Problema: "Windows protegeu seu PC"

**Causa**: Windows SmartScreen bloqueando aplicativo não assinado digitalmente.

**Solução**:
1. Clique em **"Mais informações"**
2. Clique em **"Executar assim mesmo"**

**Por que isso acontece?**
- O aplicativo não possui certificado digital (custa caro!)
- É totalmente seguro, é apenas um aviso padrão do Windows

---

### Problema: "Não consigo criar atalho na área de trabalho"

**Solução**:
1. Clique com **botão direito** no arquivo `.exe`
2. Selecione **"Enviar para → Área de Trabalho (criar atalho)"**

**OU**:
1. Clique com **botão direito** na Área de Trabalho
2. **"Novo → Atalho"**
3. Cole o caminho completo do `.exe`

---

### Problema: "O aplicativo não abre"

**Verificações**:
1. ✅ Tem o **Node.js** instalado? (não é necessário, mas verifique)
2. ✅ O arquivo está completo? (Tamanho ~200-300 MB)
3. ✅ Antivírus não está bloqueando?

**Solução alternativa**:
1. Tente a versão **ZIP** ao invés da **Portable**
2. Extraia em pasta diferente
3. Execute como usuário padrão (não como admin)

---

## ❓ Perguntas Frequentes

### 1. Qual versão devo escolher?

**Resposta**:
- **Ambiente corporativo restritivo**: Versão **Portable**
- **Uso pessoal**: Qualquer uma (NSIS é mais organizado)
- **Pendrive/portabilidade**: Versão **Portable** ou **ZIP**

---

### 2. Posso ter mais de uma versão instalada?

**Sim!** Cada opção pode coexistir:
- Portable em `Desktop/CentralIA-Portable/`
- ZIP extraído em `Documents/CentralIA-ZIP/`
- NSIS instalado em `AppData/Local/CentralIA/`

---

### 3. Como atualizar para nova versão?

**Portable/ZIP**:
1. Baixe nova versão
2. Substitua o arquivo/pasta antigo

**NSIS**:
1. Execute novo instalador
2. Instale no mesmo local
3. Configs e dados são preservados

---

### 4. Os dados são salvos onde?

**Todos os formatos salvam em**:
```
C:\Users\SeuUsuario\AppData\Roaming\Central-IA-NAPJe\
```

**Inclui**:
- Configurações do PJE
- Dados de peritos e servidores
- Cache de verificações
- Logs do sistema

---

### 5. Como remover o aplicativo?

**Portable/ZIP**:
1. Delete a pasta/arquivo
2. (Opcional) Delete dados em `AppData\Roaming\Central-IA-NAPJe\`

**NSIS**:
1. Use o desinstalador no Menu Iniciar
2. **OU** Painel de Controle → Programas → Desinstalar

---

### 6. Preciso instalar dependências?

**Não!** Tudo já está incluído:
- ✅ Electron (runtime)
- ✅ Playwright (automação)
- ✅ Node.js (embutido)
- ✅ Todas as bibliotecas

---

## 📞 Suporte

Se encontrar problemas:

1. ✅ Verifique este guia primeiro
2. ✅ Consulte o [README.md](README.md) principal
3. ✅ Reporte problemas no repositório GitHub

---

## 🔒 Segurança

**Posso confiar neste aplicativo?**

✅ **Sim!**
- Código-fonte aberto (pode auditar)
- Sem telemetria ou coleta de dados
- Roda localmente (sem internet necessária para operar)
- Dados ficam apenas no seu computador

---

## 📊 Comparação Rápida

| Critério | Portable | ZIP | NSIS |
|----------|----------|-----|------|
| Requer Admin | ❌ | ❌ | ❌* |
| Tamanho Download | ~200 MB | ~300 MB | ~200 MB |
| Instalação | Nenhuma | Extrair | Wizard |
| Atalhos | Manual | Manual | Automático |
| Desinstalar | Deletar | Deletar | Desinstalador |
| Atualizações | Manual | Manual | Sobrescrever |
| Pendrive | ✅ Sim | ✅ Sim | ❌ Não |

\* *Desde que instalado em pasta do usuário*

---

## ✅ Recomendação Final

Para **máxima compatibilidade** em ambientes corporativos restritos:

### Use a **Versão Portable**
```
Central IA - NAPJe-1.0.0-portable.exe
```

**Por quê?**
- ✅ Zero requisitos administrativos
- ✅ Funciona em qualquer Windows (7, 8, 10, 11)
- ✅ Não modifica o sistema
- ✅ Pode ser executado de qualquer pasta
- ✅ Ideal para TI restritiva

---

**Desenvolvido com ❤️ pela equipe PJE Automation Team**

🤖 *Automação Inteligente para o Sistema Judiciário Brasileiro*
