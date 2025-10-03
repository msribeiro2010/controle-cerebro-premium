// Script de teste para verificar a lógica de comparação de OJs
// Simulando o problema reportado com a Vanessa

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

// Função de normalização (copiada do script principal)
const normalizarNome = (nome) => {
  let normalizado = nome.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9\s]/g, '') // Remove caracteres especiais
    .trim();
  return normalizado;
};

// Função de comparação de OJs (copiada do script principal)
const ojsEquivalentes = (oj1, oj2) => {
  const norm1 = normalizarNome(oj1);
  const norm2 = normalizarNome(oj2);
  
  // Comparação exata primeiro
  if (norm1 === norm2) return true;
  
  // Extrair cidade do OJ do JSON (formato: "CON1 - Campinas" ou "Bauru")
  const extrairCidade = (ojJson) => {
    const normalizado = normalizarNome(ojJson);
    // Se tem formato "CON1 - Cidade", extrair a cidade
    const match = normalizado.match(/^(con\d+|exe\d+)\s*-?\s*(.+)$/);
    if (match) {
      return match[2].trim(); // Retorna a cidade
    }
    // Se não tem prefixo, é só a cidade
    return normalizado.trim();
  };
  
  // Extrair cidade do OJ do banco (formato: "Tribunal de Justiça - Bauru" ou "1ª Vara Cível de Campinas")
  const extrairCidadeDoBanco = (ojBanco) => {
    const normalizado = normalizarNome(ojBanco);
    
    // Padrões comuns de OJs no banco
    const padroes = [
      /tribunal de justica\s*-?\s*(.+)$/,           // "Tribunal de Justiça - Bauru"
      /\d*[aª°]?\s*vara.*?de\s+(.+)$/,             // "1ª Vara Cível de Campinas"
      /vara.*?de\s+(.+)$/,                         // "Vara da Fazenda Pública de Bauru"
      /foro\s+de\s+(.+)$/,                         // "Foro de Campinas"
      /comarca\s+de\s+(.+)$/,                      // "Comarca de Jundiaí"
      /(.+)$/                                      // Fallback - nome completo
    ];
    
    for (const padrao of padroes) {
      const match = normalizado.match(padrao);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    return normalizado.trim();
  };
  
  // Extrair cidades de ambos os OJs
  const cidadeJson = extrairCidade(oj1);
  const cidadeBanco = extrairCidadeDoBanco(oj2);
  
  // Verificar se as cidades são equivalentes
  if (cidadeJson === cidadeBanco) {
    return true;
  }
  
  // Verificar se a cidade do banco contém a cidade do JSON
  if (cidadeBanco.includes(cidadeJson) || cidadeJson.includes(cidadeBanco)) {
    return true;
  }
  
  // Lógica original para casos de numeração de varas
  const semNumero1 = norm1.replace(/^\d+[aª°]?\s*/, '');
  const semNumero2 = norm2.replace(/^\d+[aª°]?\s*/, '');
  
  if (semNumero1 === semNumero2) {
    const temNumero1 = /^\d+[aª°]?\s+vara/.test(norm1);
    const temNumero2 = /^\d+[aª°]?\s+vara/.test(norm2);
    
    if (!temNumero1 && temNumero2 && norm2.startsWith('1')) {
      return true;
    }
    if (!temNumero2 && temNumero1 && norm1.startsWith('1')) {
      return true;
    }
  }
  
  return false;
};

// Teste da verificação
console.log('🔍 TESTE DE VERIFICAÇÃO DE OJs - VANESSA CARDOZO DE ALMEIDA');
console.log('=' .repeat(80));

console.log('\n📋 OJs da configuração (esperados):');
ojsConfiguracaoVanessa.forEach((oj, index) => {
  console.log(`${index + 1}. ${oj}`);
});

console.log('\n📋 OJs simulados como cadastrados no sistema:');
ojsCadastradosSimulados.forEach((oj, index) => {
  console.log(`${index + 1}. ${oj}`);
});

console.log('\n🔍 ANÁLISE DE CORRESPONDÊNCIAS:');
console.log('=' .repeat(50));

let ojsEncontrados = [];
let ojsNaoEncontrados = [];

ojsConfiguracaoVanessa.forEach((ojEsperado, index) => {
  console.log(`\n${index + 1}. Verificando: "${ojEsperado}"`);
  
  let encontrado = false;
  for (let i = 0; i < ojsCadastradosSimulados.length; i++) {
    const ojCadastrado = ojsCadastradosSimulados[i];
    if (ojsEquivalentes(ojEsperado, ojCadastrado)) {
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

console.log('\n📊 RESUMO DOS RESULTADOS:');
console.log('=' .repeat(50));
console.log(`✅ OJs encontrados: ${ojsEncontrados.length}/${ojsConfiguracaoVanessa.length}`);
console.log(`❌ OJs não encontrados: ${ojsNaoEncontrados.length}/${ojsConfiguracaoVanessa.length}`);

if (ojsNaoEncontrados.length > 0) {
  console.log('\n❌ OJs que não foram reconhecidos:');
  ojsNaoEncontrados.forEach((oj, index) => {
    console.log(`${index + 1}. ${oj}`);
  });
}

console.log('\n🔍 ANÁLISE DETALHADA DE NORMALIZAÇÃO:');
console.log('=' .repeat(50));

ojsConfiguracaoVanessa.forEach((oj, index) => {
  const normalizado = normalizarNome(oj);
  console.log(`${index + 1}. Original: "${oj}"`);
  console.log(`   Normalizado: "${normalizado}"`);
});

console.log('\n🔍 POSSÍVEIS PROBLEMAS IDENTIFICADOS:');
console.log('=' .repeat(50));

// Verificar problemas comuns
const problemasIdentificados = [];

// Problema 1: Diferenças em "da" vs "de"
const temDiferencaPreposicao = ojsConfiguracaoVanessa.some(oj => 
  oj.includes('da Infância e Adolescência') && 
  !ojsCadastradosSimulados.some(ojCad => 
    ojCad.includes('da Infância e Adolescência')
  )
);

if (temDiferencaPreposicao) {
  problemasIdentificados.push('Diferenças em preposições ("da" vs "de")');
}

// Problema 2: Numeração por extenso vs numérica
const temDiferencaNumeracao = ojsConfiguracaoVanessa.some(oj => 
  /^\d+[ªº]/.test(oj)
) && ojsCadastradosSimulados.some(oj => 
  /(primeira|segunda|terceira|quarta|quinta)/i.test(oj)
);

if (temDiferencaNumeracao) {
  problemasIdentificados.push('Numeração por extenso vs numérica');
}

// Problema 3: Presença/ausência de hífens
const temDiferencaHifen = ojsConfiguracaoVanessa.some(oj => 
  !oj.includes(' - ')
) && ojsCadastradosSimulados.some(oj => 
  oj.includes(' - ')
);

if (temDiferencaHifen) {
  problemasIdentificados.push('Presença/ausência de hífens separadores');
}

if (problemasIdentificados.length > 0) {
  problemasIdentificados.forEach((problema, index) => {
    console.log(`${index + 1}. ${problema}`);
  });
} else {
  console.log('Nenhum problema óbvio identificado na lógica de comparação.');
}

console.log('\n🎯 CONCLUSÃO:');
console.log('=' .repeat(50));

if (ojsEncontrados.length === ojsConfiguracaoVanessa.length) {
  console.log('✅ SUCESSO: Todos os OJs foram reconhecidos corretamente!');
  console.log('   O problema pode estar em outro lugar (banco de dados, carregamento, etc.)');
} else {
  console.log('❌ PROBLEMA IDENTIFICADO: Alguns OJs não foram reconhecidos.');
  console.log('   A lógica de comparação precisa ser ajustada.');
  console.log(`   Taxa de sucesso: ${((ojsEncontrados.length / ojsConfiguracaoVanessa.length) * 100).toFixed(1)}%`);
}