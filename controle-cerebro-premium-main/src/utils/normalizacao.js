/**
 * Sistema de normalização de texto otimizado para OJs
 * Implementa algoritmos robustos para comparação de nomes de Órgãos Julgadores
 */

class NormalizadorTexto {
  /**
   * Stop words expandidas para melhor filtragem
   */
  static STOP_WORDS = new Set([
    // Artigos
    'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas',
    // Preposições
    'de', 'da', 'do', 'das', 'dos', 'em', 'na', 'no', 'nas', 'nos',
    'para', 'por', 'com', 'sem', 'sobre', 'sob', 'entre', 'ante',
    'apos', 'após', 'ate', 'até', 'desde', 'contra', 'perante',
    // Conjunções e conectivos
    'e', 'ou', 'mas', 'que', 'se', 'como', 'quando', 'onde'
    // Importante: NÃO incluir termos de categoria (vara, juizado, tribunal, divex, execucao, cejusc, etc.)
  ]);

  /**
   * Mapeamento de abreviações comuns
   */
  static ABREVIACOES = {
    // Tipos de vara/tribunal
    'vf': 'vara federal',
    'vc': 'vara civil',
    'vcrim': 'vara criminal',
    'vt': 'vara trabalhista',
    'je': 'juizado especial',
    'jec': 'juizado especial civil',
    'jecrim': 'juizado especial criminal',
    'jef': 'juizado especial federal',
    'trf': 'tribunal regional federal',
    'trt': 'tribunal regional trabalho',
    'tre': 'tribunal regional eleitoral',
    'tjsp': 'tribunal justica sao paulo',
    'tjrj': 'tribunal justica rio janeiro',
    'tjmg': 'tribunal justica minas gerais',
    'tjrs': 'tribunal justica rio grande sul',
    'tjpr': 'tribunal justica parana',
    'tjsc': 'tribunal justica santa catarina',
    'tjgo': 'tribunal justica goias',
    'tjba': 'tribunal justica bahia',
    'tjpe': 'tribunal justica pernambuco',
    'tjce': 'tribunal justica ceara',
    'tjdf': 'tribunal justica distrito federal',
    'tjmt': 'tribunal justica mato grosso',
    'tjms': 'tribunal justica mato grosso sul',
    'tjro': 'tribunal justica rondonia',
    'tjac': 'tribunal justica acre',
    'tjam': 'tribunal justica amazonas',
    'tjrr': 'tribunal justica roraima',
    'tjap': 'tribunal justica amapa',
    'tjpa': 'tribunal justica para',
    'tjto': 'tribunal justica tocantins',
    'tjma': 'tribunal justica maranhao',
    'tjpi': 'tribunal justica piaui',
    'tjrn': 'tribunal justica rio grande norte',
    'tjpb': 'tribunal justica paraiba',
    'tjal': 'tribunal justica alagoas',
    'tjse': 'tribunal justica sergipe',
    'tjes': 'tribunal justica espirito santo',
    
    // Localidades
    'sp': 'sao paulo',
    'rj': 'rio janeiro',
    'mg': 'minas gerais',
    'rs': 'rio grande sul',
    'pr': 'parana',
    'sc': 'santa catarina',
    'go': 'goias',
    'ba': 'bahia',
    'pe': 'pernambuco',
    'ce': 'ceara',
    'df': 'distrito federal',
    'mt': 'mato grosso',
    'ms': 'mato grosso sul',
    'ro': 'rondonia',
    'ac': 'acre',
    'am': 'amazonas',
    'rr': 'roraima',
    'ap': 'amapa',
    'pa': 'para',
    'to': 'tocantins',
    'ma': 'maranhao',
    'pi': 'piaui',
    'rn': 'rio grande norte',
    'pb': 'paraiba',
    'al': 'alagoas',
    'se': 'sergipe',
    'es': 'espirito santo',
    
    // Abreviações específicas para DIVEX
    'divex': 'divisao execucao',
    'div': 'divisao',
    'exec': 'execucao',
    'exe': 'execucao'
  };

  /**
   * Cache para normalização de texto (melhoria de performance)
   */
  static _cacheNormalizacao = new Map();
  
  /**
   * Cache para tokens significativos (melhoria de performance)
   */
  static _cacheTokens = new Map();
  
  /**
   * Normaliza texto removendo acentos, convertendo para minúsculas e limpando caracteres especiais
   * @param {string} texto - Texto para normalizar
   * @returns {string} Texto normalizado
   */
  static normalizar(texto) {
    if (!texto || typeof texto !== 'string') {
      return '';
    }

    // Verificar cache primeiro (otimização de performance)
    if (this._cacheNormalizacao.has(texto)) {
      return this._cacheNormalizacao.get(texto);
    }

    const resultado = texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[–—−]/g, '-') // Normaliza travessões (–, —, −) para hífen (-)
      .replace(/[^a-z0-9\s-]/g, ' ') // Remove caracteres especiais, mantém espaços e hífens
      .replace(/\s+/g, ' ') // Normaliza espaços múltiplos
      .trim();
    
    // Armazenar no cache (limitar tamanho do cache)
    if (this._cacheNormalizacao.size < 1000) {
      this._cacheNormalizacao.set(texto, resultado);
    }
    
    return resultado;
  }

  /**
   * Expande abreviações conhecidas no texto
   * @param {string} texto - Texto normalizado
   * @returns {string} Texto com abreviações expandidas
   */
  static expandirAbreviacoes(texto) {
    // Validação de tipos
    let textoProcessado;
    if (typeof texto === 'string') {
      textoProcessado = texto;
    } else if (texto && typeof texto === 'object' && texto.nome) {
      textoProcessado = String(texto.nome);
    } else {
      textoProcessado = String(texto || '');
    }
    
    if (!textoProcessado) {
      return '';
    }
    
    let textoExpandido = textoProcessado;
    
    // Expandir abreviações palavra por palavra
    const palavras = textoProcessado.split(' ');
    const palavrasExpandidas = palavras.map(palavra => {
      return this.ABREVIACOES[palavra] || palavra;
    });
    
    textoExpandido = palavrasExpandidas.join(' ');
    
    // Expandir abreviações compostas (ex: "1ª vc" -> "1 vara civil")
    for (const [abrev, expansao] of Object.entries(this.ABREVIACOES)) {
      const regex = new RegExp(`\\b${abrev}\\b`, 'g');
      textoExpandido = textoExpandido.replace(regex, expansao);
    }
    
    return textoExpandido;
  }

  /**
   * Extrai tokens significativos do texto
   * @param {string} texto - Texto para extrair tokens
   * @param {number} minLength - Tamanho mínimo dos tokens
   * @returns {Array<string>} Array de tokens significativos
   */
  static extrairTokensSignificativos(texto, minLength = 2) {
    // Validação de tipos
    let textoProcessado;
    if (typeof texto === 'string') {
      textoProcessado = texto;
    } else if (texto && typeof texto === 'object' && texto.nome) {
      textoProcessado = String(texto.nome);
    } else {
      textoProcessado = String(texto || '');
    }
    
    if (!textoProcessado) return [];
    
    // Verificar cache primeiro (otimização de performance)
    const chaveCache = `${textoProcessado}|${minLength}`;
    if (this._cacheTokens.has(chaveCache)) {
      return this._cacheTokens.get(chaveCache);
    }
    
    const textoNormalizado = this.normalizar(textoProcessado);
    const textoExpandido = this.expandirAbreviacoes(textoNormalizado);
    
    const tokens = textoExpandido
      .split(/\s+/)
      .filter(token => 
        token.length >= minLength && 
        !this.STOP_WORDS.has(token) &&
        !/^\d+$/.test(token) // Remove números puros
      )
      .map(token => {
        // Melhor normalização de números ordinais (1ª, 2º, 3ª, etc.)
        return token.replace(/^(\d+)[ªº°]?[ao]?$/, '$1');
      })
      .filter(token => token.length >= minLength);
    
    // Remover duplicatas mantendo ordem
    const resultado = [...new Set(tokens)];
    
    // Armazenar no cache (limitar tamanho do cache)
    if (this._cacheTokens.size < 1000) {
      this._cacheTokens.set(chaveCache, resultado);
    }
    
    return resultado;
  }

  /**
   * Calcula similaridade entre dois textos usando múltiplas métricas
   * @param {string} texto1 - Primeiro texto
   * @param {string} texto2 - Segundo texto
   * @returns {Object} Objeto com métricas de similaridade
   */
  static calcularSimilaridade(texto1, texto2) {
    const norm1 = this.normalizar(texto1);
    const norm2 = this.normalizar(texto2);
    
    // Igualdade exata normalizada
    const igualdadeExata = norm1 === norm2;
    
    // Tokens significativos
    const tokens1 = this.extrairTokensSignificativos(texto1);
    const tokens2 = this.extrairTokensSignificativos(texto2);
    
    // Cobertura de tokens (quantos tokens do primeiro estão no segundo)
    const cobertura1 = this.calcularCobertura(tokens1, tokens2);
    const cobertura2 = this.calcularCobertura(tokens2, tokens1);
    
    // Similaridade de Jaccard
    const jaccard = this.calcularJaccard(tokens1, tokens2);
    
    // Distância de Levenshtein normalizada
    const levenshtein = this.calcularLevenshteinNormalizada(norm1, norm2);
    
    return {
      igualdadeExata,
      cobertura1,
      cobertura2,
      jaccard,
      levenshtein,
      tokens1,
      tokens2,
      // Score combinado
      score: this.calcularScoreCombinado({
        igualdadeExata,
        cobertura1,
        cobertura2,
        jaccard,
        levenshtein
      })
    };
  }

  /**
   * Calcula cobertura de tokens (quantos tokens do primeiro conjunto estão no segundo)
   * @param {Array} tokens1 - Primeiro conjunto de tokens
   * @param {Array} tokens2 - Segundo conjunto de tokens
   * @returns {number} Percentual de cobertura (0-1)
   */
  static calcularCobertura(tokens1, tokens2) {
    if (tokens1.length === 0) return 0;
    
    const set2 = new Set(tokens2);
    const tokensEncontrados = tokens1.filter(token => set2.has(token));
    
    return tokensEncontrados.length / tokens1.length;
  }

  /**
   * Calcula similaridade de Jaccard entre dois conjuntos de tokens
   * @param {Array} tokens1 - Primeiro conjunto
   * @param {Array} tokens2 - Segundo conjunto
   * @returns {number} Índice de Jaccard (0-1)
   */
  static calcularJaccard(tokens1, tokens2) {
    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);
    
    const intersecao = new Set([...set1].filter(x => set2.has(x)));
    const uniao = new Set([...set1, ...set2]);
    
    return uniao.size === 0 ? 0 : intersecao.size / uniao.size;
  }

  /**
   * Calcula distância de Levenshtein normalizada
   * @param {string} str1 - Primeira string
   * @param {string} str2 - Segunda string
   * @returns {number} Similaridade normalizada (0-1)
   */
  static calcularLevenshteinNormalizada(str1, str2) {
    const distancia = this.calcularLevenshtein(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    
    return maxLength === 0 ? 1 : 1 - (distancia / maxLength);
  }

  /**
   * Calcula distância de Levenshtein entre duas strings
   * @param {string} str1 - Primeira string
   * @param {string} str2 - Segunda string
   * @returns {number} Distância de Levenshtein
   */
  static calcularLevenshtein(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substituição
            matrix[i][j - 1] + 1,     // inserção
            matrix[i - 1][j] + 1      // remoção
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Extrai apenas os números de um texto
   * @param {string} texto - Texto de entrada
   * @returns {string} Apenas os números do texto
   */
  static extrairNumeros(texto) {
    if (!texto || typeof texto !== 'string') {
      return '';
    }
    return texto.replace(/\D/g, '');
  }

  /**
   * Formata um CPF com pontos e traço
   * @param {string} cpf - CPF apenas com números
   * @returns {string} CPF formatado
   */
  static formatarCPF(cpf) {
    if (!cpf || typeof cpf !== 'string') {
      return '';
    }
    
    const numeros = this.extrairNumeros(cpf);
    if (numeros.length !== 11) {
      return cpf; // Retorna original se não tiver 11 dígitos
    }
    
    return numeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  /**
   * Calcula score combinado baseado em múltiplas métricas
   * @param {Object} metricas - Objeto com as métricas calculadas
   * @returns {number} Score combinado (0-1)
   */
  static calcularScoreCombinado(metricas) {
    const {
      igualdadeExata,
      cobertura1,
      cobertura2,
      jaccard,
      levenshtein
    } = metricas;
    
    // Se há igualdade exata, score máximo
    if (igualdadeExata) return 1.0;
    
    // Pesos para cada métrica
    const pesos = {
      cobertura: 0.4,    // Cobertura de tokens é muito importante
      jaccard: 0.3,      // Similaridade de conjuntos
      levenshtein: 0.3   // Similaridade de strings
    };
    
    // Usar a maior cobertura entre as duas direções
    const melhorCobertura = Math.max(cobertura1, cobertura2);
    
    return (
      melhorCobertura * pesos.cobertura +
      jaccard * pesos.jaccard +
      levenshtein * pesos.levenshtein
    );
  }

  /**
   * Verifica se dois textos são considerados equivalentes
   * @param {string} texto1 - Primeiro texto
   * @param {string} texto2 - Segundo texto
   * @param {number} limiarSimilaridade - Limiar mínimo de similaridade (0-1)
   * @returns {boolean} True se são equivalentes
   */
  static saoEquivalentes(texto1, texto2, limiarSimilaridade = 0.85) {
    const similaridade = this.calcularSimilaridade(texto1, texto2);
    
    // Critérios mais restritivos para evitar falsos positivos:
    // 1. Igualdade exata normalizada
    // 2. Cobertura muito alta de tokens em ambas as direções (95%)
    // 3. Score combinado acima do limiar elevado
    // 4. Jaccard alto com cobertura muito alta (critério mais restritivo)
    
    return (
      similaridade.igualdadeExata ||
      (similaridade.cobertura1 >= 0.95 && similaridade.cobertura2 >= 0.95) ||
      similaridade.score >= limiarSimilaridade ||
      (similaridade.jaccard >= 0.85 && Math.max(similaridade.cobertura1, similaridade.cobertura2) >= 0.90)
    );
  }
  
  /**
   * Limpa os caches de normalização e tokens (útil para liberar memória)
   */
  static limparCaches() {
    this._cacheNormalizacao.clear();
    this._cacheTokens.clear();
    console.log('Caches de normalização limpos');
  }
  
  /**
   * Retorna estatísticas dos caches
   * @returns {Object} Estatísticas dos caches
   */
  static obterEstatisticasCaches() {
    return {
      normalizacao: {
        tamanho: this._cacheNormalizacao.size,
        limite: 1000
      },
      tokens: {
        tamanho: this._cacheTokens.size,
        limite: 1000
      }
    };
  }
}

// Funções auxiliares para compatibilidade
function normalizarTexto(texto) {
  return NormalizadorTexto.normalizar.call(NormalizadorTexto, texto);
}

function extrairTokensSignificativos(texto, minLength = 2) {
  return NormalizadorTexto.extrairTokensSignificativos.call(NormalizadorTexto, texto, minLength);
}

function calcularSimilaridade(texto1, texto2) {
  return NormalizadorTexto.calcularSimilaridade.call(NormalizadorTexto, texto1, texto2);
}

function verificarEquivalencia(texto1, texto2, limiarSimilaridade = 0.85) {
  return NormalizadorTexto.saoEquivalentes.call(NormalizadorTexto, texto1, texto2, limiarSimilaridade);
}

function encontrarMelhorOpcao(opcoes, textoAlvo) {
  if (!opcoes || opcoes.length === 0) return null;
  
  let melhorOpcao = null;
  let melhorScore = 0;
  
  for (const opcao of opcoes) {
    const similaridade = calcularSimilaridade(textoAlvo, opcao);
    if (similaridade.score > melhorScore) {
      melhorScore = similaridade.score;
      melhorOpcao = opcao;
    }
  }
  
  // Verificar se a melhor opção atende ao critério mínimo
  if (melhorOpcao && verificarEquivalencia(textoAlvo, melhorOpcao)) {
    return melhorOpcao;
  }
  
  return null;
}

function verificarAmbiguidade(opcoes, textoAlvo, melhorOpcao, limiarAmbiguidade = 0.95) {
  if (!opcoes || !melhorOpcao) return;
  
  const melhorSimilaridade = calcularSimilaridade(textoAlvo, melhorOpcao);
  const opcoesAmbiguas = opcoes.filter(opcao => {
    if (opcao === melhorOpcao) return false;
    const similaridade = calcularSimilaridade(textoAlvo, opcao);
    return similaridade.score >= melhorSimilaridade.score * limiarAmbiguidade;
  });
  
  if (opcoesAmbiguas.length > 0) {
    const lista = [melhorOpcao, ...opcoesAmbiguas].join(' | ');
    throw new Error(`Múltiplas opções encontradas para "${textoAlvo}". Especifique melhor. Opções: ${lista}`);
  }
}

module.exports = {
  NormalizadorTexto,
  normalizarTexto,
  extrairTokensSignificativos,
  calcularSimilaridade,
  verificarEquivalencia,
  encontrarMelhorOpcao,
  verificarAmbiguidade
};
