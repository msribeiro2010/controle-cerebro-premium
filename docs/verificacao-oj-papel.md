# Sistema de Verificação OJ + Papel

Este documento descreve o novo sistema implementado para resolver o problema de verificação de órgãos julgadores (OJs) vinculados considerando tanto o OJ quanto o papel/perfil associado.

## Problema Resolvido

**Situação anterior**: O sistema verificava apenas se um OJ estava vinculado, sem considerar o papel/perfil. Isso causava os seguintes problemas:

1. **Servidor com todos OJs corretos**: Sistema pulava corretamente ✅
2. **Servidor com OJs mas papel diferente**: Sistema pulava incorretamente ❌
3. **Servidor sem OJs**: Sistema vinculava corretamente ✅

**Situação atual**: O sistema verifica OJ + papel juntos, resolvendo todos os cenários:

1. **OJ não vinculado**: PODE VINCULAR ✅
2. **OJ vinculado com papel correto**: PULAR (já está correto) ✅  
3. **OJ vinculado com papel diferente**: PODE VINCULAR (atualizar papel) ✅

## Arquitetura da Solução

### Classe `VerificacaoOJPapel`

Localizada em: `src/utils/verificacao-oj-papel.js`

#### Funcionalidades Principais

1. **`verificarOJComPapel(page, nomeOJ, papelDesejado)`**
   - Verifica se OJ está vinculado com papel específico
   - Retorna objeto com informações detalhadas da verificação
   - Usa cache para otimizar consultas repetidas

2. **`verificarLoteOJsComPapel(page, ojs, papelDesejado)`**
   - Processa lista de OJs em lote
   - Fornece estatísticas detalhadas do processamento
   - Suporte a callback de progresso

3. **Sistema de Cache Inteligente**
   - Cache baseado em chave `OJ:papel`
   - Evita verificações desnecessárias
   - Timeout configurável (5 minutos)

### Integração com Sistema Principal

O sistema foi integrado em `src/main/servidor-automation-v2.js` no método `processOrgaoJulgador()`:

```javascript
// Nova verificação integrada: OJ + papel/perfil
const papelDesejado = this.config.perfil || 'Assessor';
const verificacao = await this.verificacaoOJPapel.verificarOJComPapel(this.page, orgao, papelDesejado);

if (!verificacao.podeVincular) {
  console.log(`⏭️ PULANDO OJ: ${verificacao.motivo}`);
  return; // Skip processamento
}
```

## Fluxo de Verificação

### 1. Busca de Linhas
```javascript
// Busca elementos que podem conter OJs vinculados
const seletoresTabela = [
  'table tbody tr',
  '.mat-table .mat-row', 
  '.table tbody tr',
  // ... mais seletores
];
```

### 2. Procura do OJ
```javascript
// Verifica similaridade usando normalização de texto
if (NormalizadorTexto.saoEquivalentes(nomeOJ, textoLinha, 0.95)) {
  // OJ encontrado
}
```

### 3. Verificação do Papel
```javascript
// Procura papel na mesma linha/células próximas
const seletoresPapel = ['td', '.papel', '.perfil', 'span', 'div'];
// Extrai papel usando padrões regex
const padroes = [
  /(secretário[^,\n\t-]*)/i,
  /(assessor[^,\n\t-]*)/i,
  // ... mais padrões
];
```

### 4. Decisão Final
```javascript
if (ojEncontrado && papelCorreto) {
  return { podeVincular: false }; // Pular
} else if (ojEncontrado && !papelCorreto) {
  return { podeVincular: true };  // Pode vincular (atualizar papel)
} else {
  return { podeVincular: true };  // Pode vincular (OJ não existe)
}
```

## Resultados da Verificação

### Objeto de Retorno
```javascript
{
  jaVinculado: boolean,        // OJ está vinculado
  papelCorreto: boolean,       // Papel está correto
  papelExistente: string|null, // Papel atual encontrado
  podeVincular: boolean,       // Pode prosseguir com vinculação
  motivo: string,              // Razão da decisão
  tempoVerificacao: number,    // Tempo gasto na verificação
  detalhes: {
    ojEncontrado: boolean,
    papelEncontrado: boolean,
    elementoEncontrado: Element|null
  }
}
```

### Estatísticas de Lote
```javascript
{
  ojsVerificados: Array,           // Lista completa de verificações
  ojsJaVinculadosCorretos: Array, // OJs que podem ser pulados
  ojsComPapelDiferente: Array,    // OJs que precisam atualização
  ojsParaVincular: Array,         // OJs que não existem
  estatisticas: {
    total: number,
    jaVinculadosCorretos: number,
    comPapelDiferente: number, 
    paraVincular: number,
    tempoTotalMs: number
  }
}
```

## Exemplos de Uso

### Verificação Individual
```javascript
const verificacao = new VerificacaoOJPapel();
const resultado = await verificacao.verificarOJComPapel(
  page, 
  '1ª Vara do Trabalho', 
  'Secretário de Audiência'
);

if (resultado.podeVincular) {
  console.log('✅ Pode vincular:', resultado.motivo);
  // Prosseguir com vinculação
} else {
  console.log('⏭️ Pular:', resultado.motivo);
  // Pular este OJ
}
```

### Verificação em Lote
```javascript
const ojs = ['1ª Vara', '2ª Vara', '3ª Vara'];
const resultado = await verificacao.verificarLoteOJsComPapel(
  page, 
  ojs, 
  'Assessor',
  (mensagem, progresso) => console.log(`${progresso}%: ${mensagem}`)
);

console.log(`📊 Estatísticas:`);
console.log(`   Total: ${resultado.estatisticas.total}`);
console.log(`   Já corretos: ${resultado.estatisticas.jaVinculadosCorretos}`);
console.log(`   Para vincular: ${resultado.estatisticas.paraVincular}`);
```

## Configurações e Parâmetros

### Timeout do Cache
```javascript
const tempoLimite = 5 * 60 * 1000; // 5 minutos
```

### Threshold de Similaridade
```javascript
NormalizadorTexto.saoEquivalentes(oj1, oj2, 0.95); // 95% de similaridade
```

### Palavras-chave para Detecção de Papel
```javascript
const palavrasChavePapel = [
  'secretário', 'secretaria', 'assessor', 'analista', 
  'técnico', 'auxiliar', 'escrivão', 'oficial', 
  'diretor', 'chefe', 'coordenador', 'supervisor', 
  'gerente', 'audiência'
];
```

## Testes

Os testes unitários estão em `src/tests/unit/verificacao-oj-papel.test.js` e cobrem:

- ✅ Verificação individual de OJs
- ✅ Processamento em lote
- ✅ Sistema de cache
- ✅ Detecção de papéis
- ✅ Extração de texto
- ✅ Cenários reais de uso

Para executar os testes:
```bash
npm run test:unit -- verificacao-oj-papel
```

## Benefícios da Implementação

1. **Precisão**: Evita vinculações desnecessárias
2. **Eficiência**: Sistema de cache reduz consultas repetidas
3. **Flexibilidade**: Suporta diferentes papéis e cenários
4. **Observabilidade**: Logs detalhados e estatísticas
5. **Manutenibilidade**: Código modular e bem testado
6. **Performance**: Verificação otimizada com timeouts adaptativos

## Monitoramento e Debug

### Logs de Debug
```
🔍 Verificando OJ "1ª Vara do Trabalho" com papel "Secretário de Audiência"
✅ OJ encontrado: "1ª Vara do Trabalho - Assessor"
📋 Papel atual: "Assessor" | Desejado: "Secretário de Audiência" | Match: false
🔄 OJ vinculado com papel diferente - PODE VINCULAR
   Papel atual: "Assessor" → Novo: "Secretário de Audiência"
```

### Relatórios de Performance
```javascript
const relatorio = verificacao.gerarRelatorio();
console.log(`📊 Taxa de aproveitamento: ${relatorio.taxaAproveitamento}%`);
```

Este sistema resolve completamente o problema descrito, garantindo que OJs sejam vinculados apenas quando necessário, considerando tanto o órgão quanto o papel/perfil associado.