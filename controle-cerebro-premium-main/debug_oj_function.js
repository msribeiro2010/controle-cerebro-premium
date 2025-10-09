/**
 * Debug da função ojsEquivalentes para entender por que não está detectando cidades diferentes
 */

// Função de normalização (copiada do script.js)
const normalizarNome = (nome) => {
  if (!nome) return '';
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

// Função auxiliar para verificar se os OJs são equivalentes (VERSÃO COM DEBUG)
const ojsEquivalentesDebug = (oj1, oj2) => {
  console.log(`\n🔍 DEBUG: Comparando "${oj1}" vs "${oj2}"`);
  
  // Normalizar ambos os nomes
  let norm1 = normalizarNome(oj1);
  let norm2 = normalizarNome(oj2);
  
  console.log(`   Normalizado: "${norm1}" vs "${norm2}"`);
  
  // Converter números por extenso
  norm1 = converterNumeroExtenso(norm1);
  norm2 = converterNumeroExtenso(norm2);
  
  console.log(`   Após conversão: "${norm1}" vs "${norm2}"`);
  
  // Comparação exata primeiro
  if (norm1 === norm2) {
    console.log(`   ✅ Match exato!`);
    return true;
  }
  
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
  
  console.log(`   Padronizado: "${norm1Padronizado}" vs "${norm2Padronizado}"`);
  
  // Comparação após padronização
  if (norm1Padronizado === norm2Padronizado) {
    console.log(`   ✅ Match após padronização!`);
    return true;
  }
  
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
    
    // Extrair cidade (capturar após o último "de")
    console.log(`   Tentando extrair cidade de: "${texto}"`);
    
    // Para padrões como "vara de trabalho de sao jose de campos"
    // Precisamos pegar tudo após o "de" que vem depois da especialidade
    if (componentes.especialidade) {
      // Procurar por " de " após a especialidade
      const especialidadeIndex = texto.indexOf(componentes.especialidade);
      if (especialidadeIndex !== -1) {
        const textoAposEspecialidade = texto.substring(especialidadeIndex + componentes.especialidade.length);
        const deIndex = textoAposEspecialidade.indexOf(' de ');
        if (deIndex !== -1) {
          componentes.cidade = textoAposEspecialidade.substring(deIndex + 4).trim();
          console.log(`   ✅ Cidade extraída após especialidade: "${componentes.cidade}"`);
        } else {
          componentes.cidade = texto.trim();
          console.log(`   ⚠️ Cidade extraída como texto completo (sem 'de' após especialidade): "${componentes.cidade}"`);
        }
      } else {
        componentes.cidade = texto.trim();
        console.log(`   ⚠️ Cidade extraída como texto completo (especialidade não encontrada): "${componentes.cidade}"`);
      }
    } else {
      // Se não tem especialidade, usar a última ocorrência de " de "
      const ultimoDeIndex = texto.lastIndexOf(' de ');
      if (ultimoDeIndex !== -1) {
        componentes.cidade = texto.substring(ultimoDeIndex + 4).trim();
        console.log(`   ✅ Cidade extraída via lastIndexOf: "${componentes.cidade}"`);
      } else {
        // Se não tem padrão específico, pode ser só a cidade
        componentes.cidade = texto.trim();
        console.log(`   ⚠️ Cidade extraída como texto completo: "${componentes.cidade}"`);
      }
    }
    
    return componentes;
  };
  
  const comp1 = extrairComponentes(norm1Padronizado);
  const comp2 = extrairComponentes(norm2Padronizado);
  
  console.log(`   Componentes 1:`, comp1);
  console.log(`   Componentes 2:`, comp2);
  
  // Comparar componentes
  const tipoMatch = comp1.tipo === comp2.tipo;
  const numeroMatch = !comp1.numero || !comp2.numero || comp1.numero === comp2.numero;
  const especialidadeMatch = !comp1.especialidade || !comp2.especialidade || comp1.especialidade === comp2.especialidade;
  const cidadeMatch = comp1.cidade === comp2.cidade || 
                     comp1.cidade.includes(comp2.cidade) || 
                     comp2.cidade.includes(comp1.cidade);
  
  console.log(`   Matches: tipo=${tipoMatch}, numero=${numeroMatch}, especialidade=${especialidadeMatch}, cidade=${cidadeMatch}`);
  
  // Se ambos têm cidade definida e são diferentes, não pode ser match
  if (comp1.cidade && comp2.cidade && !cidadeMatch) {
    console.log(`   ❌ Cidades diferentes detectadas: "${comp1.cidade}" vs "${comp2.cidade}"`);
    return false;
  }
  
  // Considerar match se a maioria dos componentes coincidirem
  const matches = [tipoMatch, numeroMatch, especialidadeMatch, cidadeMatch];
  const matchCount = matches.filter(Boolean).length;
  
  console.log(`   Match count: ${matchCount}/4`);
  
  // Exigir pelo menos 3 de 4 componentes para considerar match
  const result = matchCount >= 3;
  console.log(`   Resultado final: ${result}`);
  
  return result;
};

// Testar casos problemáticos
console.log("🐛 DEBUG DOS CASOS PROBLEMÁTICOS");
console.log("=" .repeat(60));

// Caso 1: Franca vs São José dos Campos
ojsEquivalentesDebug("Franca", "Vara do Trabalho de São José dos Campos");

// Caso 2: Limeira vs Franca
ojsEquivalentesDebug("Limeira", "2ª Vara do Trabalho de Franca");