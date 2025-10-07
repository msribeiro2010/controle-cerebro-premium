/**
 * Teste para verificar se a função ojsEquivalentes corrigida está funcionando
 * Este teste simula a função corrigida que foi aplicada no script.js
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

// Função auxiliar para verificar se os OJs são equivalentes (VERSÃO CORRIGIDA)
const ojsEquivalentes = (oj1, oj2) => {
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
    
    // Extrair cidade (capturar após o último "de")
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
        } else {
          componentes.cidade = texto.trim();
        }
      } else {
        componentes.cidade = texto.trim();
      }
    } else {
      // Se não tem especialidade, usar a última ocorrência de " de "
      const ultimoDeIndex = texto.lastIndexOf(' de ');
      if (ultimoDeIndex !== -1) {
        componentes.cidade = texto.substring(ultimoDeIndex + 4).trim();
      } else {
        // Se não tem padrão específico, pode ser só a cidade
        componentes.cidade = texto.trim();
      }
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
  
  // Se ambos têm cidade definida e são diferentes, não pode ser match
  if (comp1.cidade && comp2.cidade && !cidadeMatch) {
    return false;
  }
  
  // Considerar match se a maioria dos componentes coincidirem
  const matches = [tipoMatch, numeroMatch, especialidadeMatch, cidadeMatch];
  const matchCount = matches.filter(Boolean).length;
  
  // Exigir pelo menos 3 de 4 componentes para considerar match
  return matchCount >= 3;
};

// Casos de teste baseados nos problemas identificados anteriormente
const testCases = [
  {
    oj1: "Franca",
    oj2: "2ª Vara do Trabalho de Franca",
    expected: true,
    description: "Cidade simples vs Vara específica"
  },
  {
    oj1: "São José dos Campos",
    oj2: "Primeira Vara do Trabalho de São José dos Campos",
    expected: true,
    description: "Cidade com preposições vs Vara com número por extenso"
  },
  {
    oj1: "São José dos Campos",
    oj2: "5ª Vara do Trabalho de São José Dos Campos",
    expected: true,
    description: "Diferenças de capitalização em preposições"
  },
  {
    oj1: "Limeira",
    oj2: "Vara do Trabalho de Limeira",
    expected: true,
    description: "Cidade vs Vara sem número"
  },
  {
    oj1: "Limeira",
    oj2: "Juizado Especial da Infância e Adolescência de Limeira",
    expected: true,
    description: "Cidade vs Juizado Especial"
  },
  {
    oj1: "São José dos Campos",
    oj2: "Juizado Especial da Infância e Adolescência de São José Dos Campos",
    expected: true,
    description: "Preposições diferentes (dos vs Dos)"
  },
  {
    oj1: "Franca",
    oj2: "Vara do Trabalho de São José dos Campos",
    expected: false,
    description: "Cidades diferentes - deve retornar false"
  },
  {
    oj1: "Limeira",
    oj2: "2ª Vara do Trabalho de Franca",
    expected: false,
    description: "Cidades diferentes - deve retornar false"
  }
];

console.log("🧪 TESTE DA FUNÇÃO ojsEquivalentes CORRIGIDA");
console.log("=" .repeat(60));

let totalTests = testCases.length;
let passedTests = 0;

testCases.forEach((testCase, index) => {
  const result = ojsEquivalentes(testCase.oj1, testCase.oj2);
  const passed = result === testCase.expected;
  
  if (passed) {
    passedTests++;
    console.log(`✅ Teste ${index + 1}: PASSOU`);
  } else {
    console.log(`❌ Teste ${index + 1}: FALHOU`);
  }
  
  console.log(`   OJ1: "${testCase.oj1}"`);
  console.log(`   OJ2: "${testCase.oj2}"`);
  console.log(`   Esperado: ${testCase.expected}, Resultado: ${result}`);
  console.log(`   Descrição: ${testCase.description}`);
  console.log("");
});

console.log("=" .repeat(60));
console.log(`📊 RESULTADO FINAL: ${passedTests}/${totalTests} testes passaram`);
console.log(`📈 Taxa de sucesso: ${Math.round((passedTests / totalTests) * 100)}%`);

if (passedTests === totalTests) {
  console.log("🎉 TODOS OS TESTES PASSARAM! A correção está funcionando corretamente.");
} else {
  console.log("⚠️  Alguns testes falharam. A correção pode precisar de ajustes.");
}