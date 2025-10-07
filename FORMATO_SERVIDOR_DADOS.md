# Formato de Dados do Servidor - Guia Completo

## 🎯 Problema Identificado

O sistema estava processando apenas **1 vara** (Vara do Trabalho de Itu) quando deveria processar **8 localizações** completas.

**Causa Raiz:**
A ordem de prioridade dos campos estava incorreta, dando preferência para `ojs` (OJs já vinculadas) em vez de `localizacoes` (todas as OJs desejadas).

## ✅ Correção Aplicada

### Antes (INCORRETO)
```javascript
orgaos: servidor.ojs || servidor.orgaos || servidor.ojsParaProcessar || servidor.localizacoes || []
```

### Depois (CORRETO)
```javascript
orgaos: servidor.localizacoes || servidor.ojsParaProcessar || servidor.orgaos || servidor.ojs || []
```

**Por quê?**
- `localizacoes` → Contém TODAS as OJs que o servidor deve ter (incluindo novas)
- `ojsParaProcessar` → OJs ainda não vinculadas (a processar)
- `orgaos` → Nome alternativo para localizações
- `ojs` → Apenas OJs JÁ vinculadas (não inclui novas)

## 📊 Formato Correto do Objeto Servidor

### Estrutura Completa

```json
{
  "nome": "Whiteney Kaira Silva Lopes",
  "cpf": "437.633.998-95",
  "perfil": "Estagiário de Conhecimento",
  "localizacoes": [
    "Vara do Trabalho de Atibaia",
    "Vara do Trabalho de Itu",
    "Assessor - Público",
    "Assessor - Privado",
    "Central de Perícias",
    "Coordenadoria de Cálculos",
    "Núcleo de Apoio Judicial",
    "Seção de Arquivo"
  ],
  "ojs": [
    "Vara do Trabalho de Atibaia",
    "Vara do Trabalho de Itu"
  ],
  "ojsParaProcessar": [
    "Assessor - Público",
    "Assessor - Privado",
    "Central de Perícias",
    "Coordenadoria de Cálculos",
    "Núcleo de Apoio Judicial",
    "Seção de Arquivo"
  ]
}
```

### Explicação dos Campos

#### 1. **localizacoes** (PRIORITÁRIO) ⭐
```json
"localizacoes": [
  "Vara do Trabalho de Atibaia",
  "Vara do Trabalho de Itu",
  "Assessor - Público",
  ...
]
```

**Descrição:**
- Lista COMPLETA de todas as OJs/localizações que o servidor DEVE ter
- Inclui tanto OJs já vinculadas quanto novas a vincular
- É o campo MAIS IMPORTANTE - sempre deve conter a lista completa

**Quando usar:**
- ✅ Sempre que possível
- ✅ Ao cadastrar novo servidor
- ✅ Ao editar localizações de servidor existente

#### 2. **ojsParaProcessar** (IMPORTANTE)
```json
"ojsParaProcessar": [
  "Assessor - Público",
  "Assessor - Privado",
  ...
]
```

**Descrição:**
- Lista de OJs que ainda NÃO foram vinculadas
- Calculado automaticamente: `localizacoes - ojs`
- Usado pelo sistema para otimizar processamento

**Quando usar:**
- ✅ Sistema calcula automaticamente
- ⚠️ Pode ser usado para forçar processamento de OJs específicas

#### 3. **ojs** (HISTÓRICO)
```json
"ojs": [
  "Vara do Trabalho de Atibaia",
  "Vara do Trabalho de Itu"
]
```

**Descrição:**
- Lista de OJs que JÁ estão vinculadas no PJE
- Atualizado após cada processamento bem-sucedido
- Não inclui OJs novas a serem vinculadas

**Quando usar:**
- ✅ Sistema atualiza automaticamente após vinculação
- ❌ NÃO usar como fonte primária de OJs para processar

#### 4. **orgaos** (ALTERNATIVO)
```json
"orgaos": [
  "Vara do Trabalho de Atibaia",
  ...
]
```

**Descrição:**
- Nome alternativo para `localizacoes`
- Mantido para compatibilidade com versões antigas
- Funciona da mesma forma que `localizacoes`

**Quando usar:**
- ✅ Se não tiver `localizacoes`, use este
- ⚠️ Preferir `localizacoes` quando possível

## 🔄 Fluxo de Processamento

### 1. Cadastro Inicial
```json
{
  "nome": "Servidor X",
  "cpf": "123.456.789-00",
  "perfil": "Estagiário",
  "localizacoes": [
    "Vara 1",
    "Vara 2",
    "Vara 3"
  ],
  "ojs": [],
  "ojsParaProcessar": [
    "Vara 1",
    "Vara 2",
    "Vara 3"
  ]
}
```

### 2. Após Processar (Parcial)
```json
{
  "nome": "Servidor X",
  "cpf": "123.456.789-00",
  "perfil": "Estagiário",
  "localizacoes": [
    "Vara 1",
    "Vara 2",
    "Vara 3"
  ],
  "ojs": [
    "Vara 1"
  ],
  "ojsParaProcessar": [
    "Vara 2",
    "Vara 3"
  ]
}
```

### 3. Após Processar (Completo)
```json
{
  "nome": "Servidor X",
  "cpf": "123.456.789-00",
  "perfil": "Estagiário",
  "localizacoes": [
    "Vara 1",
    "Vara 2",
    "Vara 3"
  ],
  "ojs": [
    "Vara 1",
    "Vara 2",
    "Vara 3"
  ],
  "ojsParaProcessar": []
}
```

### 4. Adicionar Novas Localizações
```json
{
  "nome": "Servidor X",
  "cpf": "123.456.789-00",
  "perfil": "Estagiário",
  "localizacoes": [
    "Vara 1",
    "Vara 2",
    "Vara 3",
    "Vara 4",  // NOVA
    "Vara 5"   // NOVA
  ],
  "ojs": [
    "Vara 1",
    "Vara 2",
    "Vara 3"
  ],
  "ojsParaProcessar": [
    "Vara 4",
    "Vara 5"
  ]
}
```

## 🛠️ Como Verificar seus Dados

### 1. Abrir Console do DevTools
- Pressione `F12` no aplicativo
- Vá para aba "Console"

### 2. Verificar Servidor Específico
```javascript
// Encontrar servidor por CPF
const servidor = app.servidores.find(s => s.cpf === '437.633.998-95');
console.log('Localizações:', servidor.localizacoes);
console.log('OJs vinculadas:', servidor.ojs);
console.log('OJs para processar:', servidor.ojsParaProcessar);
```

### 3. Verificar Todos os Servidores
```javascript
app.servidores.forEach(s => {
  console.log(`\n${s.nome} (${s.cpf}):`);
  console.log('  Total localizações:', s.localizacoes?.length || 0);
  console.log('  OJs vinculadas:', s.ojs?.length || 0);
  console.log('  Para processar:', s.ojsParaProcessar?.length || 0);
});
```

## 📝 Importação de Dados

### Formato CSV Recomendado
```csv
nome,cpf,perfil,localizacao1,localizacao2,localizacao3,...
Whiteney Kaira,437.633.998-95,Estagiário,"Vara de Itu","Vara de Atibaia",...
```

### Formato JSON Recomendado
```json
[
  {
    "nome": "Whiteney Kaira Silva Lopes",
    "cpf": "437.633.998-95",
    "perfil": "Estagiário de Conhecimento",
    "localizacoes": [
      "Vara do Trabalho de Atibaia",
      "Vara do Trabalho de Itu",
      "Assessor - Público",
      "Assessor - Privado",
      "Central de Perícias",
      "Coordenadoria de Cálculos",
      "Núcleo de Apoio Judicial",
      "Seção de Arquivo"
    ]
  }
]
```

## ⚠️ Problemas Comuns

### Problema 1: Sistema processa apenas 1 OJ
**Causa:** Campo `ojs` tem prioridade sobre `localizacoes`

**Solução:**
1. Verificar se `localizacoes` está preenchido
2. Se não tiver, mover dados de `ojs` para `localizacoes`
3. Atualizar com a correção aplicada (prioridade correta)

### Problema 2: Sistema não processa nenhuma OJ
**Causa:** Nenhum dos campos está preenchido

**Solução:**
```javascript
// No console
const servidor = app.servidores.find(s => s.cpf === 'CPF_AQUI');
servidor.localizacoes = [
  "Vara 1",
  "Vara 2",
  ...
];
await app.saveServidores();
```

### Problema 3: Algumas OJs são ignoradas
**Causa:** OJs já estão em `ojs` e sistema acha que foram processadas

**Solução:**
```javascript
// Forçar reprocessamento
const servidor = app.servidores.find(s => s.cpf === 'CPF_AQUI');
servidor.ojsParaProcessar = servidor.localizacoes; // Forçar todas
await app.saveServidores();
```

## 🔍 Logs para Verificação

### Logs que indicam problema
```
🔍 [CONFIGURAÇÃO] Mantendo OJs originais da configuração:
   this.config.orgaos (TODOS para processar): ["Vara do Trabalho de Itu"]  ← APENAS 1!
   servidor.ojs (já vinculados): ["Vara do Trabalho de Atibaia","Vara do Trabalho de Itu"]
   ojsParaProcessarOtimizado (do servidor): ["Vara do Trabalho de Atibaia","Vara do Trabalho de Itu"]
```

### Logs corretos
```
🔍 [CONFIGURAÇÃO] Mantendo OJs originais da configuração:
   this.config.orgaos (TODOS para processar): ["Vara de Itu","Vara de Atibaia","Assessor - Público"...]  ← MÚLTIPLAS!
   servidor.ojs (já vinculados): ["Vara do Trabalho de Atibaia","Vara do Trabalho de Itu"]
   ojsParaProcessarOtimizado (do servidor): ["Assessor - Público","Assessor - Privado"...]
```

## 🚀 Próximos Passos

Após esta correção:

1. **Verificar dados** - Use o console para verificar se `localizacoes` está completo
2. **Testar processamento** - Execute automação de 1 servidor de teste
3. **Monitorar logs** - Confirme que todas as 8 localizações aparecem
4. **Processar em lote** - Se OK, processe todos os servidores

## 📞 Suporte

Se o problema persistir:
1. Verificar estrutura do arquivo `data/servidores.json`
2. Conferir logs no console (F12)
3. Executar scripts de verificação acima
4. Reportar com logs detalhados
