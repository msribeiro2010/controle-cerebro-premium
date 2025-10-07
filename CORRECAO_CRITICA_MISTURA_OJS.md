# 🚨 CORREÇÃO CRÍTICA: Mistura de OJs Entre Servidores

## ❌ PROBLEMA CRÍTICO DETECTADO

**Gravidade:** ⚠️⚠️⚠️ **CRÍTICO** - Sistema processando OJs ERRADAS

**Sintoma Reportado:**
Sistema tentando processar OJs que **NÃO pertencem** ao servidor atual:

**Configuração Correta:**
```
Servidor: Áquila da Silva Dias (151.520.207-00)
Perfil: Servidor
OJs:
  ✅ Vara do Trabalho de Atibaia
  ✅ Vara do Trabalho de Bragança Paulista
  ✅ Vara do Trabalho de Campo Limpo Paulista
  ✅ Vara do Trabalho de Capivari
  ✅ Vara do Trabalho de Indaiatuba
  ✅ Vara do Trabalho de Itapira
  ✅ Vara do Trabalho de Itatiba
  ✅ Vara do Trabalho de Salto
```

**Comportamento ERRADO do Sistema:**
```
🚨 Sistema tentando processar:
  ❌ "EXE1 - Jundiaí"      ← NÃO PERTENCE a este servidor!
  ❌ "EXE2 - Jundiaí"      ← NÃO PERTENCE a este servidor!
  ❌ "EXE3 - Jundiaí"      ← NÃO PERTENCE a este servidor!
  ❌ "EXE4 - Jundiaí"      ← NÃO PERTENCE a este servidor!
  ❌ "DAM - Jundiaí"       ← NÃO PERTENCE a este servidor!
  ❌ "DIVEX - Jundiaí"     ← NÃO PERTENCE a este servidor!
```

Essas OJs pertencem a **OUTRO servidor** diferente!

## 🔍 CAUSA RAIZ

**Arquivo:** `src/main/servidor-automation-v2.js` (linhas 921-945)

### Código INCORRETO (Antes):

```javascript
// PROBLEMA: Estava usando config.orgaos (GLOBAL)
if (config.orgaos && config.orgaos.length > 0) {
  this.config.orgaos = config.orgaos; // ❌ GLOBAL - mistura todos os servidores!
  console.log(`✅ Usando OJs da configuração global: ${this.config.orgaos.length} OJs`);
} else if (config.ojs && config.ojs.length > 0) {
  this.config.orgaos = config.ojs; // ❌ GLOBAL
} else if (servidor.ojs && servidor.ojs.length > 0) {
  this.config.orgaos = servidor.ojs; // ⚠️ Apenas OJs JÁ vinculadas
} else if (servidor.orgaos && servidor.orgaos.length > 0) {
  this.config.orgaos = servidor.orgaos;
}
```

### Problemas Identificados:

1. **Prioridade Errada:** Usava `config.orgaos` primeiro (configuração GLOBAL)
2. **Mistura de Dados:** `config.orgaos` pode conter OJs de MÚLTIPLOS servidores
3. **Campo Incorreto:** Priorizava `servidor.ojs` (apenas vinculadas) sobre `servidor.localizacoes` (completas)
4. **Sem Validação:** Não verificava se OJs pertenciam ao servidor atual

## ✅ CORREÇÃO APLICADA

**Arquivo:** `src/main/servidor-automation-v2.js` (linhas 921-950)

### Código CORRETO (Depois):

```javascript
// CORREÇÃO CRÍTICA: Usar OJs DO SERVIDOR ATUAL, não da configuração global
// PRIORIDADE CORRETA (conforme FORMATO_SERVIDOR_DADOS.md):
// 1. localizacoes - Lista COMPLETA de OJs deste servidor (inclui novas)
// 2. ojsParaProcessar - OJs não vinculadas deste servidor
// 3. orgaos - Nome alternativo para localizacoes
// 4. ojs - Apenas OJs JÁ vinculadas (NÃO deve ser prioritário)

console.log(`🔍 [CAMPO-DEBUG] Campos disponíveis para ${servidor.nome}:`);
console.log(`   - localizacoes: ${JSON.stringify(servidor.localizacoes || null)}`);
console.log(`   - ojsParaProcessar: ${JSON.stringify(servidor.ojsParaProcessar || null)}`);
console.log(`   - orgaos: ${JSON.stringify(servidor.orgaos || null)}`);
console.log(`   - ojs: ${JSON.stringify(servidor.ojs || null)}`);

// Usar APENAS dados DO SERVIDOR ATUAL (não misturar com outros servidores)
if (servidor.localizacoes && servidor.localizacoes.length > 0) {
  this.config.orgaos = servidor.localizacoes;
  console.log(`✅ [PRIORIDADE 1] Usando 'localizacoes' do servidor ${servidor.nome}: ${this.config.orgaos.length} OJs`);
} else if (servidor.ojsParaProcessar && servidor.ojsParaProcessar.length > 0) {
  this.config.orgaos = servidor.ojsParaProcessar;
  console.log(`✅ [PRIORIDADE 2] Usando 'ojsParaProcessar' do servidor ${servidor.nome}: ${this.config.orgaos.length} OJs`);
} else if (servidor.orgaos && servidor.orgaos.length > 0) {
  this.config.orgaos = servidor.orgaos;
  console.log(`✅ [PRIORIDADE 3] Usando 'orgaos' do servidor ${servidor.nome}: ${this.config.orgaos.length} OJs`);
} else if (servidor.ojs && servidor.ojs.length > 0) {
  this.config.orgaos = servidor.ojs;
  console.log(`⚠️ [PRIORIDADE 4 - ÚLTIMO RECURSO] Usando 'ojs' do servidor ${servidor.nome}: ${this.config.orgaos.length} OJs`);
} else {
  this.config.orgaos = [];
  console.log(`❌ [ERRO] Nenhum campo de OJs encontrado para servidor ${servidor.nome}!`);
}
```

### Mudanças Principais:

1. ✅ **Prioridade Correta:** `servidor.localizacoes` PRIMEIRO (lista completa do servidor)
2. ✅ **Isolamento:** Usa APENAS dados do servidor atual (não mistura)
3. ✅ **Debug Detalhado:** Mostra todos os campos disponíveis
4. ✅ **Logs Claros:** Indica exatamente qual campo está sendo usado
5. ✅ **Validação:** Verifica se há dados antes de usar

## 📊 Comparação: Antes vs Depois

### Cenário: 2 Servidores com OJs Diferentes

**Servidor 1:** Áquila (Atibaia, Bragança, Indaiatuba...)
**Servidor 2:** Outro (EXE1, EXE2, EXE3... Jundiaí)

| Aspecto | ANTES (ERRADO) | DEPOIS (CORRETO) |
|---------|----------------|-------------------|
| Fonte de dados | `config.orgaos` (GLOBAL) | `servidor.localizacoes` (ESPECÍFICO) |
| OJs do Servidor 1 | Misturava com Servidor 2 ❌ | Apenas do Servidor 1 ✅ |
| OJs do Servidor 2 | Misturava com Servidor 1 ❌ | Apenas do Servidor 2 ✅ |
| Validação | Nenhuma ❌ | Campo específico do servidor ✅ |
| Debug | Limitado | Completo com todos os campos ✅ |

## 🧪 Como Verificar a Correção

### Teste 1: Servidor Individual

**Setup:**
```
Servidor: Áquila da Silva Dias
CPF: 151.520.207-00
Localizações:
  - Vara do Trabalho de Atibaia
  - Vara do Trabalho de Bragança Paulista
  - Vara do Trabalho de Indaiatuba
```

**Logs Esperados (CORRETOS):**
```
🔍 [CAMPO-DEBUG] Campos disponíveis para Áquila da Silva Dias:
   - localizacoes: ["Vara do Trabalho de Atibaia","Vara do Trabalho de Bragança Paulista","Vara do Trabalho de Indaiatuba"]
   - ojsParaProcessar: null
   - orgaos: null
   - ojs: null
✅ [PRIORIDADE 1] Usando 'localizacoes' do servidor Áquila da Silva Dias: 3 OJs
🎯 OJs para processar: 3
🔍 Lista de OJs: ["Vara do Trabalho de Atibaia","Vara do Trabalho de Bragança Paulista","Vara do Trabalho de Indaiatuba"]
```

**Resultado:** ✅ Apenas OJs do servidor Áquila (NÃO mistura com outros)

### Teste 2: Múltiplos Servidores

**Setup:**
```
Servidor 1: Áquila (Atibaia, Bragança...)
Servidor 2: Reinaldo (mesmas OJs)
```

**Logs Esperados para Servidor 1:**
```
✅ [PRIORIDADE 1] Usando 'localizacoes' do servidor Áquila da Silva Dias: 8 OJs
🔍 Lista de OJs: ["Vara do Trabalho de Atibaia", ...] ← OJs do Áquila
```

**Logs Esperados para Servidor 2:**
```
✅ [PRIORIDADE 1] Usando 'localizacoes' do servidor Reinaldo Siqueira da Costa: 8 OJs
🔍 Lista de OJs: ["Vara do Trabalho de Atibaia", ...] ← OJs do Reinaldo
```

**Resultado:** ✅ Cada servidor processa APENAS suas próprias OJs

### Teste 3: Servidor com campo alternativo

**Setup:**
```
Servidor com apenas campo 'orgaos' (sem 'localizacoes')
```

**Log Esperado:**
```
🔍 [CAMPO-DEBUG] Campos disponíveis para Servidor X:
   - localizacoes: null
   - ojsParaProcessar: null
   - orgaos: ["Vara 1", "Vara 2"]
   - ojs: null
✅ [PRIORIDADE 3] Usando 'orgaos' do servidor Servidor X: 2 OJs
```

**Resultado:** ✅ Fallback para `orgaos` funciona corretamente

## 📝 Estrutura de Dados Esperada

### Formato Correto (Recomendado):

```json
{
  "nome": "Áquila da Silva Dias",
  "cpf": "151.520.207-00",
  "perfil": "Servidor",
  "localizacoes": [
    "Vara do Trabalho de Atibaia",
    "Vara do Trabalho de Bragança Paulista",
    "Vara do Trabalho de Campo Limpo Paulista",
    "Vara do Trabalho de Capivari",
    "Vara do Trabalho de Indaiatuba",
    "Vara do Trabalho de Itapira",
    "Vara do Trabalho de Itatiba",
    "Vara do Trabalho de Salto"
  ],
  "ojs": [],
  "ojsParaProcessar": [
    "Vara do Trabalho de Atibaia",
    "Vara do Trabalho de Bragança Paulista",
    ...
  ]
}
```

### Campos Explicados:

| Campo | Descrição | Quando Usar |
|-------|-----------|-------------|
| `localizacoes` | **COMPLETO** - Todas as OJs do servidor | ✅ Sempre preferir |
| `ojsParaProcessar` | Apenas OJs não vinculadas | ✅ Se não tiver localizacoes |
| `orgaos` | Nome alternativo para localizacoes | ✅ Compatibilidade |
| `ojs` | Apenas OJs JÁ vinculadas | ⚠️ Último recurso |

## 🔍 Como Identificar o Problema nos Logs

### Logs ERRADOS (Antes da Correção):

```
❌ SINTOMA: OJs de outros servidores sendo processadas
✅ Usando OJs da configuração global: 15 OJs
🔍 Lista de OJs: ["EXE1 - Jundiaí", "EXE2 - Jundiaí", "Vara de Atibaia", ...]
                  ↑ MISTURANDO OJs de servidores diferentes!
```

### Logs CORRETOS (Após Correção):

```
✅ CORRETO: Apenas OJs do servidor atual
✅ [PRIORIDADE 1] Usando 'localizacoes' do servidor Áquila da Silva Dias: 8 OJs
🔍 Lista de OJs: ["Vara do Trabalho de Atibaia", "Vara do Trabalho de Bragança Paulista", ...]
                  ↑ APENAS OJs do servidor Áquila
```

## 🎯 Impacto da Correção

### Antes (CRÍTICO):
- ❌ Servidores processavam OJs de OUTROS servidores
- ❌ Dados de múltiplos servidores misturados
- ❌ Vinculações ERRADAS no sistema PJE
- ❌ Potencial corrupção de dados

### Depois (CORRETO):
- ✅ Cada servidor processa APENAS suas próprias OJs
- ✅ Isolamento completo entre servidores
- ✅ Vinculações CORRETAS no sistema PJE
- ✅ Integridade de dados garantida

## 📋 Checklist de Validação

Antes de executar a automação, verificar:

- [ ] Cada servidor tem o campo `localizacoes` preenchido
- [ ] Não há OJs duplicadas entre diferentes servidores (a menos que intencional)
- [ ] Logs mostram `[PRIORIDADE 1] Usando 'localizacoes'`
- [ ] Lista de OJs corresponde ao servidor atual
- [ ] Não aparecem OJs de outros servidores nos logs

## ⚠️ Nota Importante

Esta correção é **CRÍTICA** para a integridade do sistema. Sem ela, o sistema pode:

- ❌ Vincular OJs erradas a servidores
- ❌ Corromper dados no PJE
- ❌ Criar vínculos inválidos
- ❌ Necessitar correção manual posterior

**Sempre verifique os logs** antes de confirmar que a automação processou corretamente!

## 📞 Suporte

Se ainda aparecerem OJs erradas nos logs:

1. Verificar estrutura de `data/servidores.json`
2. Confirmar que cada servidor tem o campo `localizacoes`
3. Verificar logs de `[CAMPO-DEBUG]` para ver todos os campos
4. Reportar com logs completos e dados do servidor

---

**Status:** ✅ CORRIGIDO
**Arquivo:** `src/main/servidor-automation-v2.js` (linhas 921-950)
**Data:** 2025-10-05
**Prioridade:** 🚨 CRÍTICA
**Verificação de Sintaxe:** ✅ Passou
