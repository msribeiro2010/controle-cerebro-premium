# 🍎 Solução para Janela não Aparecer no macOS

## 📋 Problema
A aplicação PJE Automation executa corretamente mas a janela não aparece visualmente no macOS.

## ✅ Soluções Disponíveis

### 1. 🚀 Atalho Melhorado (Recomendado)
Use o atalho atualizado no desktop:
- **Arquivo:** `PJE Automation.command` (no Desktop)
- **Funcionalidade:** Inicia a aplicação e tenta automaticamente trazer a janela para frente
- **Como usar:** Clique duas vezes no atalho

### 2. 🔧 Script de Força (Se a janela ainda não aparecer)
Se a aplicação estiver executando mas a janela não aparecer:
```bash
./force-window-front.sh
```

### 3. 🔍 Verificações Manuais

#### Verificar se a aplicação está executando:
```bash
ps aux | grep -i electron | grep -v grep
```

#### Verificar no Dock:
- Procure pelo ícone do **Electron** no Dock
- Clique no ícone para trazer a janela para frente

#### Usar Cmd+Tab:
- Pressione `Cmd + Tab` para alternar entre aplicações
- Procure por "Electron" ou "PJE Automation"

#### Mission Control:
- Pressione `F3` ou `Ctrl + ↑` para ver todas as janelas abertas
- Procure pela janela do PJE Automation

### 4. 🔄 Reiniciar a Aplicação
Se nada funcionar:
1. Feche a aplicação atual: `Ctrl + C` no terminal
2. Execute novamente o atalho do desktop

## 🛠️ Configurações do Sistema

### Permitir Controle de Acessibilidade (Se necessário)
1. Vá em **Preferências do Sistema** > **Segurança e Privacidade**
2. Aba **Privacidade** > **Acessibilidade**
3. Adicione o **Terminal** à lista de aplicações permitidas
4. Isso permite que os scripts AppleScript controlem a interface

### Verificar Permissões do Electron
1. **Preferências do Sistema** > **Segurança e Privacidade**
2. Aba **Geral**
3. Se houver bloqueio do Electron, clique em "Permitir mesmo assim"

## 📞 Suporte Adicional

Se o problema persistir:
1. Verifique se há atualizações do macOS
2. Reinicie o computador
3. Verifique se há conflitos com outros softwares de automação
4. Execute a aplicação diretamente: `npm start` (no diretório do projeto)

## 🎯 Comandos Úteis

```bash
# Verificar processos Electron
ps aux | grep -i electron

# Forçar janela para frente
./force-window-front.sh

# Executar aplicação diretamente
npm start

# Verificar logs do sistema (se necessário)
log show --predicate 'process == "Electron"' --last 5m
```

---

**💡 Dica:** O atalho melhorado já inclui várias tentativas automáticas de trazer a janela para frente. Na maioria dos casos, isso resolve o problema.