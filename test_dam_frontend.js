const fs = require('fs');
const path = require('path');

// Simular a função de normalização do frontend
function normalizarNome(nome) {
  let normalizado = nome.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9\s]/g, '') // Remove caracteres especiais
    .trim();
  
  return normalizado;
}

// Função para verificar se os OJs são equivalentes (do frontend)
function ojsEquivalentes(oj1, oj2) {
  const norm1 = normalizarNome(oj1);
  const norm2 = normalizarNome(oj2);
  
  // Comparação exata primeiro
  if (norm1 === norm2) return true;
  
  // Verificar se um tem numeração e outro não (ex: "1ª Vara" vs "Vara")
  const semNumero1 = norm1.replace(/^\d+[aª°]?\s*/, '');
  const semNumero2 = norm2.replace(/^\d+[aª°]?\s*/, '');
  
  // Se removendo números ficam iguais, verificar se é caso de vara única
  if (semNumero1 === semNumero2) {
    // Verificar se um não tem número (vara única) e outro tem "1ª"
    const temNumero1 = /^\d+[aª°]?\s+vara/.test(norm1);
    const temNumero2 = /^\d+[aª°]?\s+vara/.test(norm2);
    
    if (!temNumero1 && temNumero2 && norm2.startsWith('1')) {
      return true; // "Vara do Trabalho" equivale a "1ª Vara do Trabalho"
    }
    if (!temNumero2 && temNumero1 && norm1.startsWith('1')) {
      return true; // "1ª Vara do Trabalho" equivale a "Vara do Trabalho"
    }
  }
  
  return false;
}

// Carregar dados dos OJs
const ojsPath = path.join(__dirname, 'src', 'renderer', 'ojs1g.json');
let ojs1g = [];

try {
  const data = fs.readFileSync(ojsPath, 'utf8');
  const ojsData = JSON.parse(data);
  // Extrair apenas os nomes dos OJs
  ojs1g = ojsData.map(oj => oj.ds_orgao_julgador);
  console.log(`📊 Total de OJs carregados: ${ojs1g.length}`);
} catch (error) {
  console.error('❌ Erro ao carregar ojs1g.json:', error.message);
  process.exit(1);
}

// Teste específico para DAM - Jundiaí
console.log('\n🔍 TESTE: Busca por DAM - Jundiaí no frontend');
console.log('=' .repeat(50));

const ojProcurado = "DAM - Jundiaí";
console.log(`🎯 Procurando por: "${ojProcurado}"`);

// 1. Busca exata
const buscaExata = ojs1g.find(oj => oj === ojProcurado);
console.log(`📍 Busca exata: ${buscaExata ? '✅ ENCONTRADO' : '❌ NÃO ENCONTRADO'}`);

// 2. Busca normalizada
const ojNormalizado = normalizarNome(ojProcurado);
console.log(`🔄 OJ normalizado: "${ojNormalizado}"`);

const buscaNormalizada = ojs1g.find(oj => normalizarNome(oj) === ojNormalizado);
console.log(`📍 Busca normalizada: ${buscaNormalizada ? '✅ ENCONTRADO' : '❌ NÃO ENCONTRADO'}`);
if (buscaNormalizada) {
  console.log(`   Resultado: "${buscaNormalizada}"`);
}

// 3. Busca com função de equivalência
const buscaEquivalente = ojs1g.find(oj => ojsEquivalentes(oj, ojProcurado));
console.log(`📍 Busca equivalente: ${buscaEquivalente ? '✅ ENCONTRADO' : '❌ NÃO ENCONTRADO'}`);
if (buscaEquivalente) {
  console.log(`   Resultado: "${buscaEquivalente}"`);
}

// 4. Listar todos os OJs que contêm "DAM"
console.log('\n📋 Todos os OJs que contêm "DAM":');
const ojsDAM = ojs1g.filter(oj => oj.toLowerCase().includes('dam'));
ojsDAM.forEach((oj, index) => {
  console.log(`   ${index + 1}. "${oj}"`);
  console.log(`      Normalizado: "${normalizarNome(oj)}"`);
  console.log(`      Equivalente a "${ojProcurado}": ${ojsEquivalentes(oj, ojProcurado) ? '✅' : '❌'}`);
});

// 5. Teste de variações de entrada
console.log('\n🧪 Teste de variações de entrada:');
const variacoes = [
  "DAM - Jundiaí",
  "DAM Jundiaí", 
  "DAM-Jundiaí",
  "dam - jundiai",
  "Dam - Jundiai",
  "DAM - JUNDIAÍ"
];

variacoes.forEach(variacao => {
  const encontrado = ojs1g.find(oj => ojsEquivalentes(oj, variacao));
  console.log(`   "${variacao}" → ${encontrado ? '✅ ENCONTRADO' : '❌ NÃO ENCONTRADO'}`);
  if (encontrado) {
    console.log(`      Resultado: "${encontrado}"`);
  }
});

console.log('\n' + '='.repeat(50));
console.log('🏁 Teste concluído');