/**
 * Teste para verificar se "DAM - Jundiaí" está sendo encontrado corretamente
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

// Função de busca (simulando a busca do sistema)
function buscarOJ(termoBusca) {
  const termoNormalizado = normalizarTexto(termoBusca);
  console.log(`🔍 Buscando por: "${termoBusca}"`);
  console.log(`📝 Termo normalizado: "${termoNormalizado}"`);
  
  const resultados = ojs.filter(oj => {
    const ojNormalizado = normalizarTexto(oj.ds_orgao_julgador);
    const match = ojNormalizado.includes(termoNormalizado) || 
                  termoNormalizado.includes(ojNormalizado) ||
                  ojNormalizado === termoNormalizado;
    
    if (match) {
      console.log(`✅ Match encontrado: "${oj.ds_orgao_julgador}" -> "${ojNormalizado}"`);
    }
    
    return match;
  });
  
  return resultados;
}

// Testes específicos para DAM - Jundiaí
console.log('=== TESTE: DAM - Jundiaí ===\n');

const termosParaTestar = [
  'DAM - Jundiaí',
  'DAM Jundiaí',
  'dam jundiai',
  'DAM-Jundiaí',
  'dam - jundiai'
];

termosParaTestar.forEach(termo => {
  console.log(`\n--- Testando: "${termo}" ---`);
  const resultados = buscarOJ(termo);
  
  if (resultados.length > 0) {
    console.log(`✅ Encontrados ${resultados.length} resultado(s):`);
    resultados.forEach(r => console.log(`   - ${r.ds_orgao_julgador}`));
  } else {
    console.log(`❌ Nenhum resultado encontrado`);
  }
});

// Verificar se DAM - Jundiaí existe exatamente na base
console.log('\n=== VERIFICAÇÃO DIRETA NA BASE ===');
const damJundiai = ojs.find(oj => oj.ds_orgao_julgador === 'DAM - Jundiaí');
if (damJundiai) {
  console.log('✅ "DAM - Jundiaí" existe na base de dados');
  console.log(`📍 Posição no array: ${ojs.indexOf(damJundiai)}`);
} else {
  console.log('❌ "DAM - Jundiaí" NÃO encontrado na base de dados');
}

// Listar todos os OJs que contêm "DAM"
console.log('\n=== TODOS OS OJs COM "DAM" ===');
const ojsDAM = ojs.filter(oj => oj.ds_orgao_julgador.includes('DAM'));
console.log(`Encontrados ${ojsDAM.length} OJs com "DAM":`);
ojsDAM.forEach((oj, index) => {
  console.log(`${index + 1}. ${oj.ds_orgao_julgador}`);
});

// Verificar se há problemas de encoding ou caracteres especiais
console.log('\n=== ANÁLISE DE CARACTERES ===');
if (damJundiai) {
  const texto = damJundiai.ds_orgao_julgador;
  console.log(`Texto: "${texto}"`);
  console.log(`Comprimento: ${texto.length}`);
  console.log(`Códigos dos caracteres:`, [...texto].map(c => c.charCodeAt(0)));
  console.log(`Normalizado: "${normalizarTexto(texto)}"`);
}