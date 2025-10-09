/**
 * Teste específico para analisar a extração de cidade
 */

function normalizarNome(nome) {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function converterNumeroExtenso(texto) {
  const numerosExtensos = {
    'primeira': '1', 'segundo': '2', 'segunda': '2', 'terceira': '3', 'terceiro': '3',
    'quarta': '4', 'quarto': '4', 'quinta': '5', 'quinto': '5',
    'sexta': '6', 'sexto': '6', 'setima': '7', 'setimo': '7',
    'oitava': '8', 'oitavo': '8', 'nona': '9', 'nono': '9', 'decima': '10', 'decimo': '10'
  };
  
  let resultado = texto;
  for (const [extenso, numero] of Object.entries(numerosExtensos)) {
    const regex = new RegExp(`\\b${extenso}\\b`, 'gi');
    resultado = resultado.replace(regex, numero);
  }
  
  return resultado;
}

function padronizarTexto(texto) {
  return texto
    .replace(/\bdo\b/g, 'de')
    .replace(/\bda\b/g, 'de')
    .replace(/\bdos\b/g, 'de')
    .replace(/\bdas\b/g, 'de');
}

function extrairComponentes(texto) {
  console.log(`🔍 Analisando: "${texto}"`);
  
  const componentes = {
    tipo: '',
    numero: '',
    especialidade: '',
    cidade: ''
  };

  // Extrair tipo
  if (texto.includes('vara')) componentes.tipo = 'vara';
  else if (texto.includes('juizado')) componentes.tipo = 'juizado';
  else if (texto.includes('tribunal')) componentes.tipo = 'tribunal';
  
  console.log(`   Tipo extraído: "${componentes.tipo}"`);

  // Extrair número
  const regexNumero = /(\d+)[ªº°]?/;
  const matchNumero = texto.match(regexNumero);
  if (matchNumero) {
    componentes.numero = matchNumero[1];
  }
  
  console.log(`   Número extraído: "${componentes.numero}"`);

  // Extrair especialidade
  if (texto.includes('trabalho')) componentes.especialidade = 'trabalho';
  else if (texto.includes('civel')) componentes.especialidade = 'civel';
  else if (texto.includes('criminal')) componentes.especialidade = 'criminal';
  
  console.log(`   Especialidade extraída: "${componentes.especialidade}"`);

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

  console.log(`   Componentes finais:`, componentes);
  console.log('');
  
  return componentes;
}

// Testes específicos
console.log('🧪 TESTE DE EXTRAÇÃO DE CIDADE');
console.log('='.repeat(50));

const casos = [
  "franca",
  "vara de trabalho de sao jose de campos",
  "2 vara de trabalho de franca",
  "limeira"
];

casos.forEach((caso, index) => {
  console.log(`\n📋 Caso ${index + 1}:`);
  extrairComponentes(caso);
});