// Versão corrigida da função de comparação de OJs
// Baseada nos problemas identificados no teste

// OJs da configuração da Vanessa (do usuário)
const ojsConfiguracaoVanessa = [
  "Divisão de Execução de Limeira",
  "Juizado Especial da Infância e Adolescência de Franca", 
  "Juizado Especial da Infância e Adolescência de São José Dos Campos",
  "1ª Vara do Trabalho de Franca",
  "1ª Vara do Trabalho de São José Dos Campos", 
  "2ª Vara do Trabalho de Franca",
  "2ª Vara do Trabalho de São José Dos Campos",
  "3ª Vara do Trabalho de São José Dos Campos",
  "4ª Vara do Trabalho de São José Dos Campos",
  "5ª Vara do Trabalho de São José Dos Campos"
];

// OJs que poderiam estar cadastrados no sistema (simulando diferentes formatos)
const ojsCadastradosSimulados = [
  "Divisão de Execução - Limeira",
  "Juizado Especial da Infância e da Adolescência de Franca",
  "Juizado Especial da Infância e da Adolescência de São José dos Campos", 
  "1ª Vara do Trabalho - Franca",
  "Primeira Vara do Trabalho de São José dos Campos",
  "2ª Vara do Trabalho - Franca", 
  "Segunda Vara do Trabalho de São José dos Campos",
  "3ª Vara do Trabalho - São José dos Campos",
  "Quarta Vara do Trabalho de São José dos Campos",
  "5ª Vara do Trabalho - São José dos Campos"
];

// Função de normalização melhorada
const normalizarNome = (nome) => {
  let normalizado = nome.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9\s]/g, ' ') // Substitui caracteres especiais por espaço
    .replace(/\s+/g, ' ') // Remove espaços múltiplos
    .trim();
  return normalizado;
};

// Função para converter números por extenso para numérico
const converterNumeroExtenso = (texto) => {
  const mapeamento = {
    'primeira': '1',
    'segundo': '2', 'segunda': '2',
    'terceiro': '3', 'terceira': '3',
    'quarto': '4', 'quarta': '4',
    'quinto': '5', 'quinta': '5',
    'sexto': '6', 'sexta': '6',
    'setimo': '7', 'setima': '7',
    'oitavo': '8', 'oitava': '8',
    'nono': '9', 'nona': '9',
    'decimo': '10', 'decima': '10'
  };
  
  let resultado = texto;
  for (const [extenso, numerico] of Object.entries(mapeamento)) {
    const regex = new RegExp(`\\b${extenso}\\b`, 'gi');
    resultado = resultado.replace(regex, numerico);
  }
  
  return resultado;
};

// Função melhorada de comparação de OJs
const ojsEquivalentesCorrigida = (oj1, oj2) => {
  // Normalizar ambos os nomes
  let norm1 = normalizarNome(oj1);
  let norm2 = normalizarNome(oj2);
  
  // Converter números por extenso
  norm1 = converterNumeroExtenso(norm1);
  norm2 = converterNumeroExtenso(norm2);
  
  // Comparação exata primeiro
  if (norm1 === norm2) return true;
  
  // Padronizar variações comuns
  const padronizarVariacoes = (texto) => {
    return texto
      // Padronizar preposições
      .replace(/\bda\b/g, 'de')
      .replace(/\bdo\b/g, 'de')
      .replace(/\bdos\b/g, 'de')
      .replace(/\bdas\b/g, 'de')
      // Padronizar "e" vs "e da/de"
      .replace(/\be da\b/g, 'e')
      .replace(/\be de\b/g, 'e')
      // Remover hífens e espaços extras
      .replace(/\s*-\s*/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };
  
  const norm1Padronizado = padronizarVariacoes(norm1);
  const norm2Padronizado = padronizarVariacoes(norm2);
  
  // Comparação após padronização
  if (norm1Padronizado === norm2Padronizado) return true;
  
  // Extrair componentes principais para comparação mais flexível
  const extrairComponentes = (texto) => {
    const componentes = {
      tipo: '', // vara, juizado, divisao, etc.
      numero: '', // 1, 2, 3, etc.
      especialidade: '', // trabalho, infancia, execucao, etc.
      cidade: '' // franca, sao jose dos campos, limeira, etc.
    };
    
    // Extrair número
    const matchNumero = texto.match(/\b(\d+)\b/);
    if (matchNumero) {
      componentes.numero = matchNumero[1];
    }
    
    // Extrair tipo
    if (texto.includes('vara')) componentes.tipo = 'vara';
    else if (texto.includes('juizado')) componentes.tipo = 'juizado';
    else if (texto.includes('divisao')) componentes.tipo = 'divisao';
    else if (texto.includes('tribunal')) componentes.tipo = 'tribunal';
    else if (texto.includes('foro')) componentes.tipo = 'foro';
    
    // Extrair especialidade
    if (texto.includes('trabalho')) componentes.especialidade = 'trabalho';
    else if (texto.includes('infancia')) componentes.especialidade = 'infancia';
    else if (texto.includes('execucao')) componentes.especialidade = 'execucao';
    else if (texto.includes('civel')) componentes.especialidade = 'civel';
    else if (texto.includes('criminal')) componentes.especialidade = 'criminal';
    
    // Extrair cidade (última parte após "de")
    const partesDeCity = texto.split(' de ');
    if (partesDeCity.length > 1) {
      componentes.cidade = partesDeCity[partesDeCity.length - 1].trim();
    }
    
    return componentes;
  };
  
  const comp1 = extrairComponentes(norm1Padronizado);
  const comp2 = extrairComponentes(norm2Padronizado);
  
  // Comparar componentes
  const tipoMatch = comp1.tipo === comp2.tipo;
  const numeroMatch = !comp1.numero || !comp2.numero || comp1.numero === comp2.numero;
  const especialidadeMatch = !comp1.especialidade || !comp2.especialidade || comp1.especialidade === comp2.especialidade;
  const cidadeMatch = comp1.cidade === comp2.cidade || 
                     comp1.cidade.includes(comp2.cidade) || 
                     comp2.cidade.includes(comp1.cidade);
  
  // Considerar match se a maioria dos componentes coincidirem
  const matches = [tipoMatch, numeroMatch, especialidadeMatch, cidadeMatch];
  const matchCount = matches.filter(Boolean).length;
  
  // Debug
  console.log(`   Comparando componentes:`);
  console.log(`     Tipo: "${comp1.tipo}" vs "${comp2.tipo}" = ${tipoMatch}`);
  console.log(`     Número: "${comp1.numero}" vs "${comp2.numero}" = ${numeroMatch}`);
  console.log(`     Especialidade: "${comp1.especialidade}" vs "${comp2.especialidade}" = ${especialidadeMatch}`);
  console.log(`     Cidade: "${comp1.cidade}" vs "${comp2.cidade}" = ${cidadeMatch}`);
  console.log(`     Score: ${matchCount}/4`);
  
  // Exigir pelo menos 3 de 4 componentes para considerar match
  return matchCount >= 3;
};

// Teste da verificação corrigida
console.log('🔍 TESTE CORRIGIDO DE VERIFICAÇÃO DE OJs - VANESSA CARDOZO DE ALMEIDA');
console.log('=' .repeat(80));

console.log('\n🔍 ANÁLISE DE CORRESPONDÊNCIAS (VERSÃO CORRIGIDA):');
console.log('=' .repeat(60));

let ojsEncontrados = [];
let ojsNaoEncontrados = [];

ojsConfiguracaoVanessa.forEach((ojEsperado, index) => {
  console.log(`\n${index + 1}. Verificando: "${ojEsperado}"`);
  
  let encontrado = false;
  for (let i = 0; i < ojsCadastradosSimulados.length; i++) {
    const ojCadastrado = ojsCadastradosSimulados[i];
    if (ojsEquivalentesCorrigida(ojEsperado, ojCadastrado)) {
      console.log(`   ✅ MATCH encontrado com: "${ojCadastrado}"`);
      ojsEncontrados.push({
        esperado: ojEsperado,
        encontrado: ojCadastrado
      });
      encontrado = true;
      break;
    }
  }
  
  if (!encontrado) {
    console.log(`   ❌ NÃO ENCONTRADO`);
    ojsNaoEncontrados.push(ojEsperado);
  }
});

console.log('\n📊 RESUMO DOS RESULTADOS CORRIGIDOS:');
console.log('=' .repeat(50));
console.log(`✅ OJs encontrados: ${ojsEncontrados.length}/${ojsConfiguracaoVanessa.length}`);
console.log(`❌ OJs não encontrados: ${ojsNaoEncontrados.length}/${ojsConfiguracaoVanessa.length}`);

if (ojsNaoEncontrados.length > 0) {
  console.log('\n❌ OJs que ainda não foram reconhecidos:');
  ojsNaoEncontrados.forEach((oj, index) => {
    console.log(`${index + 1}. ${oj}`);
  });
}

console.log('\n🎯 CONCLUSÃO CORRIGIDA:');
console.log('=' .repeat(50));

if (ojsEncontrados.length === ojsConfiguracaoVanessa.length) {
  console.log('✅ SUCESSO: Todos os OJs foram reconhecidos corretamente!');
  console.log('   A lógica corrigida resolve o problema de reconhecimento.');
} else {
  console.log('❌ AINDA HÁ PROBLEMAS: Alguns OJs não foram reconhecidos.');
  console.log(`   Taxa de sucesso: ${((ojsEncontrados.length / ojsConfiguracaoVanessa.length) * 100).toFixed(1)}%`);
  console.log('   Melhorias adicionais são necessárias.');
}