/**
 * Sistema Inteligente de Normalização de Nomes de Órgãos Julgadores
 * Resolve problemas de grafia e variações nos nomes de OJs
 */

class OJNameNormalizer {
  constructor() {
    // Mapeamento de variações conhecidas
    this.variacoesMapeadas = new Map([
      // DIVEX - Divisões de Execução
      ['divisao de execucao', 'DIVEX'],
      ['divisão de execução', 'DIVEX'],
      ['div. de execucao', 'DIVEX'],
      ['div de execucao', 'DIVEX'],
      ['divisao execucao', 'DIVEX'],
      
      // CEJUSC
      ['centro judiciario', 'CEJUSC'],
      ['centro judiciário', 'CEJUSC'],
      ['centro de conciliacao', 'CEJUSC'],
      ['centro de conciliação', 'CEJUSC'],
      
      // Varas do Trabalho
      ['vara do trabalho', 'VT'],
      ['vara trabalhista', 'VT'],
      ['v.t.', 'VT'],
      ['vt ', 'VT'],
      
      // Tribunal
      ['tribunal regional do trabalho', 'TRT'],
      ['tribunal reg. trabalho', 'TRT'],
      ['trib. regional', 'TRT'],
      
      // Gabinete
      ['gabinete desembargador', 'Gabinete Des.'],
      ['gab. desembargador', 'Gabinete Des.'],
      ['gabinete des.', 'Gabinete Des.'],
      
      // Turmas
      ['primeira turma', '1ª Turma'],
      ['segunda turma', '2ª Turma'],
      ['terceira turma', '3ª Turma'],
      ['quarta turma', '4ª Turma'],
      ['quinta turma', '5ª Turma'],
      ['sexta turma', '6ª Turma'],
      ['setima turma', '7ª Turma'],
      ['oitava turma', '8ª Turma'],
      ['nona turma', '9ª Turma'],
      ['decima turma', '10ª Turma'],
      
      // Câmaras
      ['camara', 'Câmara'],
      ['primeira camara', '1ª Câmara'],
      ['segunda camara', '2ª Câmara'],
      
      // Seções
      ['secao especializada', 'Seção Especializada'],
      ['seçao especializada', 'Seção Especializada'],
      ['secao espec.', 'Seção Especializada'],
      
      // Presidência
      ['presidencia', 'Presidência'],
      ['gabinete da presidencia', 'Gabinete da Presidência'],
      ['gab. presidencia', 'Gabinete da Presidência'],
      
      // Corregedoria
      ['corregedoria regional', 'Corregedoria Regional'],
      ['correg. regional', 'Corregedoria Regional'],
      
      // Outros
      ['posto avancado', 'Posto Avançado'],
      ['posto avançado', 'Posto Avançado'],
      ['nucleo', 'Núcleo'],
      ['secretaria', 'Secretaria'],
      ['coordenadoria', 'Coordenadoria']
    ]);

    // Padrões de substituição regex
    this.padroes = [
      // Números ordinais
      { pattern: /\b1a\b/gi, replacement: '1ª' },
      { pattern: /\b2a\b/gi, replacement: '2ª' },
      { pattern: /\b3a\b/gi, replacement: '3ª' },
      { pattern: /\b4a\b/gi, replacement: '4ª' },
      { pattern: /\b5a\b/gi, replacement: '5ª' },
      { pattern: /\b6a\b/gi, replacement: '6ª' },
      { pattern: /\b7a\b/gi, replacement: '7ª' },
      { pattern: /\b8a\b/gi, replacement: '8ª' },
      { pattern: /\b9a\b/gi, replacement: '9ª' },
      { pattern: /\b10a\b/gi, replacement: '10ª' },
      
      // Números com ponto
      { pattern: /(\d+)\.?\s*vara/gi, replacement: '$1ª Vara' },
      { pattern: /(\d+)\.?\s*turma/gi, replacement: '$1ª Turma' },
      { pattern: /(\d+)\.?\s*camara/gi, replacement: '$1ª Câmara' },
      
      // Abreviações
      { pattern: /\bpres\.\s*prudente\b/gi, replacement: 'Presidente Prudente' },
      { pattern: /\bs\.\s*jose\s*do\s*rio\s*preto\b/gi, replacement: 'São José do Rio Preto' },
      { pattern: /\bs\.\s*jose\s*dos\s*campos\b/gi, replacement: 'São José dos Campos' },
      { pattern: /\bs\.\s*bernardo\b/gi, replacement: 'São Bernardo do Campo' },
      { pattern: /\brib\.\s*preto\b/gi, replacement: 'Ribeirão Preto' },
      
      // Remover espaços extras
      { pattern: /\s+/g, replacement: ' ' },
      { pattern: /\s*-\s*/g, replacement: ' - ' },
      { pattern: /\s*\/\s*/g, replacement: '/' }
    ];
  }

  /**
   * Normaliza o nome de um OJ
   * @param {string} nomeOJ - Nome do OJ para normalizar
   * @returns {string} Nome normalizado
   */
  normalizar(nomeOJ) {
    if (!nomeOJ) return '';
    
    let nome = nomeOJ.trim();
    
    // 1. Converter para minúsculas para comparação
    const nomeLower = nome.toLowerCase();
    
    // 2. Verificar mapeamento direto
    for (const [variacao, padrao] of this.variacoesMapeadas) {
      if (nomeLower.includes(variacao)) {
        nome = nome.replace(new RegExp(variacao, 'gi'), padrao);
      }
    }
    
    // 3. Aplicar padrões regex
    for (const { pattern, replacement } of this.padroes) {
      nome = nome.replace(pattern, replacement);
    }
    
    // 4. Capitalizar palavras importantes
    nome = this.capitalizarCorretamente(nome);
    
    // 5. Remover espaços no início e fim
    return nome.trim();
  }

  /**
   * Capitaliza corretamente o nome do OJ
   * @param {string} nome - Nome para capitalizar
   * @returns {string} Nome capitalizado
   */
  capitalizarCorretamente(nome) {
    const palavrasMinusculas = ['de', 'do', 'da', 'dos', 'das', 'e'];
    const palavrasMaiusculas = ['DIVEX', 'CEJUSC', 'TRT', 'VT', 'OAB'];
    
    return nome.split(' ').map((palavra, index) => {
      // Manter palavras que devem ser maiúsculas
      if (palavrasMaiusculas.includes(palavra.toUpperCase())) {
        return palavra.toUpperCase();
      }
      
      // Primeira palavra sempre maiúscula
      if (index === 0) {
        return palavra.charAt(0).toUpperCase() + palavra.slice(1).toLowerCase();
      }
      
      // Palavras que devem ser minúsculas (exceto após hífen)
      if (palavrasMinusculas.includes(palavra.toLowerCase()) && !nome[nome.indexOf(palavra) - 1]?.match(/[-/]/)) {
        return palavra.toLowerCase();
      }
      
      // Capitalizar normalmente
      return palavra.charAt(0).toUpperCase() + palavra.slice(1).toLowerCase();
    }).join(' ');
  }

  /**
   * Encontra a melhor correspondência para um nome de OJ
   * @param {string} nomeOJ - Nome do OJ para buscar
   * @param {Array} listaOJs - Lista de OJs disponíveis
   * @returns {Object} Melhor correspondência encontrada
   */
  encontrarMelhorCorrespondencia(nomeOJ, listaOJs) {
    const nomeNormalizado = this.normalizar(nomeOJ);
    let melhorCorrespondencia = null;
    let melhorSimilaridade = 0;
    
    for (const oj of listaOJs) {
      const ojNormalizado = this.normalizar(oj);
      const similaridade = this.calcularSimilaridade(nomeNormalizado, ojNormalizado);
      
      if (similaridade > melhorSimilaridade) {
        melhorSimilaridade = similaridade;
        melhorCorrespondencia = oj;
      }
    }
    
    return {
      original: nomeOJ,
      normalizado: nomeNormalizado,
      melhorCorrespondencia,
      similaridade: melhorSimilaridade,
      confiavel: melhorSimilaridade > 0.8
    };
  }

  /**
   * Calcula similaridade entre dois textos (Levenshtein)
   * @param {string} str1 - Primeira string
   * @param {string} str2 - Segunda string
   * @returns {number} Similaridade (0 a 1)
   */
  calcularSimilaridade(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;
    const maxLen = Math.max(len1, len2);
    
    if (maxLen === 0) return 1;
    
    const matrix = [];
    
    for (let i = 0; i <= len2; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= len1; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= len2; i++) {
      for (let j = 1; j <= len1; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    const distance = matrix[len2][len1];
    return 1 - (distance / maxLen);
  }

  /**
   * Valida e corrige lista de OJs
   * @param {Array} ojsOriginais - Lista de OJs originais
   * @param {Array} ojsDisponiveis - Lista de OJs disponíveis no sistema
   * @returns {Object} Resultado da validação
   */
  validarECorrigirOJs(ojsOriginais, ojsDisponiveis) {
    const resultados = [];
    const ojsCorrigidos = [];
    const ojsProblematicos = [];
    
    for (const ojOriginal of ojsOriginais) {
      const resultado = this.encontrarMelhorCorrespondencia(ojOriginal, ojsDisponiveis);
      
      if (resultado.confiavel) {
        ojsCorrigidos.push(resultado.melhorCorrespondencia);
        resultados.push({
          original: ojOriginal,
          corrigido: resultado.melhorCorrespondencia,
          status: 'corrigido',
          similaridade: resultado.similaridade
        });
      } else if (resultado.similaridade > 0.5) {
        ojsCorrigidos.push(resultado.melhorCorrespondencia);
        resultados.push({
          original: ojOriginal,
          sugerido: resultado.melhorCorrespondencia,
          status: 'sugestao',
          similaridade: resultado.similaridade
        });
      } else {
        ojsProblematicos.push(ojOriginal);
        resultados.push({
          original: ojOriginal,
          status: 'nao_encontrado',
          similaridade: resultado.similaridade
        });
      }
    }
    
    return {
      sucesso: ojsProblematicos.length === 0,
      ojsCorrigidos,
      ojsProblematicos,
      resultados,
      estatisticas: {
        total: ojsOriginais.length,
        corrigidos: ojsCorrigidos.length,
        problematicos: ojsProblematicos.length
      }
    };
  }
}

// Função helper para validação de CPF
function validarCPF(cpf) {
  // Remove caracteres não numéricos
  cpf = cpf.replace(/\D/g, '');
  
  // Verifica se tem 11 dígitos
  if (cpf.length !== 11) {
    return { valido: false, erro: 'CPF deve ter 11 dígitos' };
  }
  
  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1+$/.test(cpf)) {
    return { valido: false, erro: 'CPF inválido (todos dígitos iguais)' };
  }
  
  // Validação dos dígitos verificadores
  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(cpf.charAt(i)) * (10 - i);
  }
  
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.charAt(9))) {
    return { valido: false, erro: 'CPF inválido (dígito verificador incorreto)' };
  }
  
  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(cpf.charAt(i)) * (11 - i);
  }
  
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.charAt(10))) {
    return { valido: false, erro: 'CPF inválido (dígito verificador incorreto)' };
  }
  
  return { valido: true, cpfFormatado: formatarCPF(cpf) };
}

// Formata CPF
function formatarCPF(cpf) {
  cpf = cpf.replace(/\D/g, '');
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

// Importar o normalizador inteligente
const OJIntelligentNormalizer = require('./oj-intelligent-normalizer');

module.exports = { OJNameNormalizer, validarCPF, formatarCPF, OJIntelligentNormalizer };