/**
 * Teste específico para problema de acentos na busca de OJs
 */

const fs = require('fs');
const path = require('path');

// Carregar dados dos OJs
const ojsPath = path.join(__dirname, 'ojs1g.json');
const ojs = JSON.parse(fs.readFileSync(ojsPath, 'utf8'));

// Função de normalização (copiada do script.js)
function normalizarTexto(texto) {
  if (!texto) return '';
  
  let normalizado = texto
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[–—−]/g, '-') // Normaliza travessões para hífen comum
    .replace(/\s*-\s*/g, ' - ') // Normaliza espaços ao redor de hífens
    .replace(/\s+/g, ' ') // Normaliza espaços múltiplos
    .trim();
  
  // Padrão especial: se começa com código (LIQ1, EXE1, DAM, etc.) seguido de espaço e cidade
  // Garantir que sempre tenha hífen entre código e cidade
  const padraoCodigoCidade = /^(liq\d+|exe\d+|dam|con\d+|divex|ccp)\s+(.+)$/;
  if (padraoCodigoCidade.test(normalizado) && !normalizado.includes(' - ')) {
    normalizado = normalizado.replace(padraoCodigoCidade, '$1 - $2');
  }
  
  return normalizado;
}

// Função de busca melhorada (com normalização de ambos os lados)
function buscarOJMelhorado(termoBusca) {
  const termoNormalizado = normalizarTexto(termoBusca);
  console.log(`🔍 Buscando por: "${termoBusca}"`);
  console.log(`📝 Termo normalizado: "${termoNormalizado}"`);
  
  const resultados = ojs.filter(oj => {
    const ojNormalizado = normalizarTexto(oj.ds_orgao_julgador);
    
    // Comparação exata após normalização
    const matchExato = ojNormalizado === termoNormalizado;
    
    // Comparação por inclusão
    const matchInclusao = ojNormalizado.includes(termoNormalizado) || 
                         termoNormalizado.includes(ojNormalizado);
    
    if (matchExato || matchInclusao) {
      console.log(`✅ Match encontrado: "${oj.ds_orgao_julgador}" -> "${ojNormalizado}"`);
      console.log(`   Tipo: ${matchExato ? 'EXATO' : 'INCLUSÃO'}`);
    }
    
    return matchExato || matchInclusao;
  });
  
  return resultados;
}

console.log('=== TESTE DE ACENTOS: DAM - Jundiaí ===\n');

// Casos problemáticos identificados
const casosProblematicos = [
  'dam jundiai',      // sem hífen, sem acento
  'dam - jundiai',    // com hífen, sem acento
  'DAM Jundiai',      // sem hífen, sem acento, maiúsculo
  'DAM - Jundiai'     // com hífen, sem acento, maiúsculo
];

casosProblematicos.forEach(termo => {
  console.log(`\n--- Testando caso problemático: "${termo}" ---`);
  const resultados = buscarOJMelhorado(termo);
  
  if (resultados.length > 0) {
    console.log(`✅ Encontrados ${resultados.length} resultado(s):`);
    resultados.forEach(r => console.log(`   - ${r.ds_orgao_julgador}`));
  } else {
    console.log(`❌ Nenhum resultado encontrado`);
    
    // Análise detalhada do que pode estar errado
    const termoNormalizado = normalizarTexto(termo);
    console.log(`   Termo normalizado: "${termoNormalizado}"`);
    
    // Verificar se existe algum OJ similar
    const ojsSimilares = ojs.filter(oj => {
      const ojNorm = normalizarTexto(oj.ds_orgao_julgador);
      return ojNorm.includes('dam') && ojNorm.includes('jundiai');
    });
    
    if (ojsSimilares.length > 0) {
      console.log(`   🔍 OJs similares encontrados:`);
      ojsSimilares.forEach(oj => {
        console.log(`      - "${oj.ds_orgao_julgador}" -> "${normalizarTexto(oj.ds_orgao_julgador)}"`);
      });
    }
  }
});

// Teste de normalização específica
console.log('\n=== ANÁLISE DE NORMALIZAÇÃO ===');

const textoOriginal = 'DAM - Jundiaí';
const textoSemAcento = 'DAM - Jundiai';

console.log(`Original: "${textoOriginal}"`);
console.log(`Normalizado: "${normalizarTexto(textoOriginal)}"`);
console.log(`Sem acento: "${textoSemAcento}"`);
console.log(`Sem acento normalizado: "${normalizarTexto(textoSemAcento)}"`);
console.log(`São iguais após normalização? ${normalizarTexto(textoOriginal) === normalizarTexto(textoSemAcento)}`);

// Verificar se a configuração da perita pode estar vindo sem acentos
console.log('\n=== SIMULAÇÃO DE CONFIGURAÇÃO SEM ACENTOS ===');

const configSimulada = [
  'Vara do Trabalho de Itatiba',
  'Vara do Trabalho de Campo Limpo Paulista', 
  'Vara do Trabalho de Bragança Paulista',
  'Vara do Trabalho de Indaiatuba',
  'Vara do Trabalho de Itapira',
  'Vara do Trabalho de Salto',
  'Vara do Trabalho de Capivari',
  'Vara do Trabalho de Atibaia',
  'LIQ2 - Jundiaí',
  'EXE3 - Jundiaí', 
  'EXE4 - Jundiaí',
  'DAM Jundiai'  // Possível forma como vem na configuração
];

console.log('Testando configuração simulada:');
configSimulada.forEach(oj => {
  const resultados = buscarOJMelhorado(oj);
  const status = resultados.length > 0 ? '✅' : '❌';
  console.log(`${status} ${oj} -> ${resultados.length} resultado(s)`);
});