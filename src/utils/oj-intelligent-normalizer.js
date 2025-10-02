/**
 * Sistema Inteligente de Normalização de OJs
 * Corrige automaticamente variações e erros de grafia nos nomes de órgãos julgadores
 */

class OJIntelligentNormalizer {
  constructor() {
    // Padrões de varas do trabalho
    this.padraoVaras = {
      // Padrão correto: "Vara do Trabalho de [CIDADE]" ou "[Nº]ª Vara do Trabalho de [CIDADE]"
      simples: /^Vara do Trabalho de (.+)$/,
      numerada: /^(\d+)ª Vara do Trabalho de (.+)$/,
      
      // Variações incorretas comuns
      variacoes: [
        // "1ª Vara Pirassununga" → "1ª Vara do Trabalho de Pirassununga"
        /^(\d+)ª Vara ([A-Z].+)$/,
        // "Vara Pirassununga" → "Vara do Trabalho de Pirassununga"
        /^Vara ([A-Z].+)$/,
        // "1 Vara Pirassununga" → "1ª Vara do Trabalho de Pirassununga"
        /^(\d+) Vara ([A-Z].+)$/,
        // "VT Pirassununga" → "Vara do Trabalho de Pirassununga"
        /^VT ([A-Z].+)$/,
        // "V.T. Pirassununga" → "Vara do Trabalho de Pirassununga"
        /^V\.?T\.? ([A-Z].+)$/,
        // "1ª VT Pirassununga" → "1ª Vara do Trabalho de Pirassununga"
        /^(\d+)ª VT ([A-Z].+)$/,
        // "Primeira Vara Pirassununga" → "1ª Vara do Trabalho de Pirassununga"
        /^(Primeira|Segunda|Terceira|Quarta|Quinta|Sexta|Sétima|Oitava|Nona|Décima) Vara ([A-Z].+)$/i
      ]
    };

    // Mapeamento de números por extenso
    this.numerosExtenso = {
      'primeira': '1ª',
      'segunda': '2ª',
      'terceira': '3ª',
      'quarta': '4ª',
      'quinta': '5ª',
      'sexta': '6ª',
      'sétima': '7ª',
      'oitava': '8ª',
      'nona': '9ª',
      'décima': '10ª'
    };

    // Correções de cidades com erros comuns
    this.correcoesCidades = new Map([
      // Santa Bárbara D'Oeste - variações com apóstrofo
      ['santa bárbara d\'oeste', 'Santa Bárbara d\'Oeste'],
      ['santa barbara d\'oeste', 'Santa Bárbara d\'Oeste'],
      ['santa bárbara doeste', 'Santa Bárbara d\'Oeste'],
      ['santa barbara doeste', 'Santa Bárbara d\'Oeste'],
      ['santa bárbara d’oeste', 'Santa Bárbara d\'Oeste'],
      ['santa barbara d’oeste', 'Santa Bárbara d\'Oeste'],
      // Erros de digitação comuns
      ['pirassununga', 'Pirassununga'],
      ['pirasununga', 'Pirassununga'],
      ['pirassunga', 'Pirassununga'],
      ['bebedoro', 'Bebedouro'],
      ['jaboticaba', 'Jaboticabal'],
      ['mocóca', 'Mococa'],
      ['sao carlos', 'São Carlos'],
      ['s. carlos', 'São Carlos'],
      ['sao jose rio pardo', 'São José do Rio Pardo'],
      ['s. j. rio pardo', 'São José do Rio Pardo'],
      ['aracatuba', 'Araçatuba'],
      ['taquaritinga', 'Taquaritinga'],
      ['ribeirao preto', 'Ribeirão Preto'],
      ['rib. preto', 'Ribeirão Preto'],
      ['sao jose dos campos', 'São José dos Campos'],
      ['s. j. dos campos', 'São José dos Campos'],
      ['pres. prudente', 'Presidente Prudente'],
      ['presidente prudente', 'Presidente Prudente'],
      ['lencois paulista', 'Lençóis Paulista'],
      ['mogi guacu', 'Mogi Guaçu'],
      ['tatui', 'Tatuí'],
      ['jundiai', 'Jundiaí'],
      ['avare', 'Avaré'],
      ['aracatuba', 'Araçatuba'],
      ['taubate', 'Taubaté'],
      ['hortolandia', 'Hortolândia'],
      ['itapolis', 'Itápolis'],
      ['jau', 'Jaú'],
      ['jose bonifacio', 'José Bonifácio'],
      ['lencois', 'Lençóis Paulista'],
      ['matao', 'Matão'],
      ['marilia', 'Marília'],
      ['bauru', 'Bauru'],
      ['campinas', 'Campinas'],
      ['sorocaba', 'Sorocaba'],
      ['santos', 'Santos'],
      ['guarulhos', 'Guarulhos'],
      ['sao bernardo', 'São Bernardo do Campo'],
      ['santo andre', 'Santo André'],
      ['sao caetano', 'São Caetano do Sul'],
      ['diadema', 'Diadema'],
      ['maua', 'Mauá'],
      ['suzano', 'Suzano'],
      ['poa', 'Poá'],
      ['itaquaquecetuba', 'Itaquaquecetuba'],
      ['guaruja', 'Guarujá'],
      ['cubatao', 'Cubatão'],
      ['praia grande', 'Praia Grande'],
      ['sao vicente', 'São Vicente']
    ]);

    // Lista de cidades válidas do TRT15 para busca fuzzy
    this.cidadesTRT15 = [
      'Adamantina', 'Americana', 'Amparo', 'Andradina', 'Aparecida', 'Araraquara',
      'Araras', 'Araçatuba', 'Assis', 'Atibaia', 'Avaré', 'Barretos', 'Batatais',
      'Bauru', 'Bebedouro', 'Birigui', 'Botucatu', 'Bragança Paulista', 'Cajuru',
      'Campinas', 'Campo Limpo Paulista', 'Capivari', 'Capão Bonito', 'Caraguatatuba',
      'Catanduva', 'Caçapava', 'Cravinhos', 'Cruzeiro', 'Dracena', 'Fernandópolis',
      'Franca', 'Garça', 'Guaratinguetá', 'Hortolândia', 'Indaiatuba', 'Itanhaém',
      'Itapetininga', 'Itapeva', 'Itapira', 'Itararé', 'Itatiba', 'Itu', 'Ituverava',
      'Itápolis', 'Jaboticabal', 'Jacareí', 'Jales', 'Jaú', 'José Bonifácio', 'Jundiaí',
      'Leme', 'Lençóis Paulista', 'Limeira', 'Lins', 'Lorena', 'Marília', 'Matão',
      'Mococa', 'Mogi Guaçu', 'Mogi Mirim', 'Nova Odessa', 'Olímpia', 'Orlândia',
      'Ourinhos', 'Paulínia', 'Pederneiras', 'Penápolis', 'Piedade', 'Piracicaba',
      'Pirassununga', 'Porto Ferreira', 'Presidente Prudente', 'Presidente Venceslau',
      'Rancharia', 'Registro', 'Ribeirão Preto', 'Rio Claro', 'Salto', 'Santa Bárbara d\'Oeste',
      'Santa Cruz do Rio Pardo', 'Santana de Parnaíba', 'Santos', 'São Bernardo do Campo',
      'São Caetano do Sul', 'São Carlos', 'São João da Boa Vista', 'São Joaquim da Barra',
      'São José do Rio Pardo', 'São José do Rio Preto', 'São José dos Campos',
      'São Manuel', 'São Roque', 'São Sebastião', 'Sertãozinho', 'Sorocaba', 'Sumaré',
      'Tanabi', 'Taquaritinga', 'Tatuí', 'Taubaté', 'Teodoro Sampaio', 'Tietê',
      'Tupã', 'Ubatuba', 'Várzea Paulista', 'Vinhedo', 'Votorantim', 'Votuporanga'
    ];
  }

  /**
   * Normaliza o nome de um OJ para o formato correto
   */
  normalizar(nomeOJ) {
    if (!nomeOJ) return '';

    let nome = nomeOJ.trim();

    // Tratamento especial para Santa Bárbara D'Oeste
    if (nome.toLowerCase().includes('santa') &&
        (nome.toLowerCase().includes('bárbara') || nome.toLowerCase().includes('barbara'))) {
      // Normalizar diferentes variações de apóstrofo
      nome = nome.replace(/d['’‘‛`´]oeste/gi, 'd\'Oeste');
      nome = nome.replace(/doeste/gi, 'd\'Oeste');
    }
    
    // 1. Verificar se já está no formato correto
    if (this.padraoVaras.simples.test(nome) || this.padraoVaras.numerada.test(nome)) {
      // Apenas corrigir a cidade se necessário
      return this.corrigirCidade(nome);
    }
    
    // 2. Tentar corrigir variações conhecidas
    for (const pattern of this.padraoVaras.variacoes) {
      const match = nome.match(pattern);
      if (match) {
        if (match.length === 2) {
          // Padrão sem número: "Vara Pirassununga"
          const cidade = this.normalizarCidade(match[1]);
          return `Vara do Trabalho de ${cidade}`;
        } else if (match.length === 3) {
          // Padrão com número: "1ª Vara Pirassununga"
          let numero = match[1];
          const cidade = this.normalizarCidade(match[2]);
          
          // Converter número por extenso se necessário
          if (isNaN(numero)) {
            numero = this.numerosExtenso[numero.toLowerCase()] || numero;
          } else if (!numero.includes('ª')) {
            numero = `${numero}ª`;
          }
          
          return `${numero} Vara do Trabalho de ${cidade}`;
        }
      }
    }
    
    // 3. Se não conseguiu corrigir, tentar extrair cidade do nome
    const cidade = this.extrairCidade(nome);
    if (cidade) {
      // Verificar se tem número no início
      const numeroMatch = nome.match(/^(\d+)ª?/);
      if (numeroMatch) {
        return `${numeroMatch[1]}ª Vara do Trabalho de ${cidade}`;
      }
      return `Vara do Trabalho de ${cidade}`;
    }
    
    // 4. Retornar original se não conseguiu normalizar
    return nome;
  }

  /**
   * Normaliza o nome de uma cidade
   */
  normalizarCidade(cidade) {
    if (!cidade) return '';
    
    const cidadeLower = cidade.toLowerCase().trim();
    
    // Verificar correções conhecidas
    if (this.correcoesCidades.has(cidadeLower)) {
      return this.correcoesCidades.get(cidadeLower);
    }
    
    // Capitalizar corretamente
    return this.capitalizarCidade(cidade);
  }

  /**
   * Capitaliza corretamente o nome de uma cidade
   */
  capitalizarCidade(cidade) {
    // Tratamento especial para Santa Bárbara d'Oeste
    if (cidade.toLowerCase().includes('santa') &&
        (cidade.toLowerCase().includes('bárbara') || cidade.toLowerCase().includes('barbara'))) {
      return 'Santa Bárbara d\'Oeste';
    }

    const preposicoes = ['de', 'do', 'da', 'dos', 'das', 'd\''];
    
    return cidade
      .toLowerCase()
      .split(' ')
      .map((palavra, index) => {
        // Primeira palavra sempre maiúscula
        if (index === 0) {
          return palavra.charAt(0).toUpperCase() + palavra.slice(1);
        }
        
        // Preposições em minúscula
        if (preposicoes.includes(palavra)) {
          return palavra;
        }
        
        // Resto em maiúscula
        return palavra.charAt(0).toUpperCase() + palavra.slice(1);
      })
      .join(' ');
  }

  /**
   * Extrai o nome da cidade de um texto de OJ
   */
  extrairCidade(texto) {
    // Buscar cidade mais provável usando busca fuzzy
    let melhorCidade = null;
    let melhorSimilaridade = 0;
    
    const textoLower = texto.toLowerCase();
    
    for (const cidade of this.cidadesTRT15) {
      const cidadeLower = cidade.toLowerCase();
      
      // Verificar se a cidade está contida no texto
      if (textoLower.includes(cidadeLower)) {
        const similaridade = cidadeLower.length / textoLower.length;
        if (similaridade > melhorSimilaridade) {
          melhorSimilaridade = similaridade;
          melhorCidade = cidade;
        }
      }
      
      // Verificar similaridade usando distância de Levenshtein
      const similaridade = this.calcularSimilaridade(textoLower, cidadeLower);
      if (similaridade > melhorSimilaridade && similaridade > 0.6) {
        melhorSimilaridade = similaridade;
        melhorCidade = cidade;
      }
    }
    
    return melhorCidade;
  }

  /**
   * Corrige o nome da cidade em um OJ já formatado
   */
  corrigirCidade(nomeOJ) {
    const matchSimples = nomeOJ.match(this.padraoVaras.simples);
    const matchNumerada = nomeOJ.match(this.padraoVaras.numerada);
    
    if (matchSimples) {
      const cidade = this.normalizarCidade(matchSimples[1]);
      return `Vara do Trabalho de ${cidade}`;
    } else if (matchNumerada) {
      const numero = matchNumerada[1];
      const cidade = this.normalizarCidade(matchNumerada[2]);
      return `${numero}ª Vara do Trabalho de ${cidade}`;
    }
    
    return nomeOJ;
  }

  /**
   * Calcula similaridade entre duas strings (0 a 1)
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
   * Encontra a melhor correspondência para um OJ em uma lista
   */
  encontrarMelhorCorrespondencia(nomeOJ, listaOJs) {
    const nomeNormalizado = this.normalizar(nomeOJ);
    
    // Primeiro tentar correspondência exata após normalização
    for (const oj of listaOJs) {
      if (oj === nomeNormalizado) {
        return {
          encontrado: true,
          original: nomeOJ,
          normalizado: nomeNormalizado,
          correspondencia: oj,
          tipo: 'exata',
          confianca: 1.0
        };
      }
    }
    
    // Verificar se o nome original contém códigos específicos que não devem ser convertidos
    const codigosEspecificos = /\b(CON[1-9]|EXE[1-9]|LIQ[1-9])\b/i;
    const temCodigoEspecifico = codigosEspecificos.test(nomeOJ);
    
    // Se não encontrou exata, buscar por cidade
    const cidade = this.extrairCidade(nomeOJ);
    if (cidade) {
      // Buscar OJs da mesma cidade
      let ojsCidade = listaOJs.filter(oj => 
        oj.toLowerCase().includes(cidade.toLowerCase())
      );
      
      // Se o nome original tem código específico, filtrar para evitar conversões para CCP/CEJUSC
      if (temCodigoEspecifico) {
        ojsCidade = ojsCidade.filter(oj => 
          !oj.toLowerCase().includes('ccp') && 
          !oj.toLowerCase().includes('centro de conciliação') &&
          !oj.toLowerCase().includes('cejusc')
        );
      }
      
      if (ojsCidade.length === 1) {
        // Apenas um OJ da cidade, provavelmente é esse
        return {
          encontrado: true,
          original: nomeOJ,
          normalizado: nomeNormalizado,
          correspondencia: ojsCidade[0],
          tipo: 'cidade_unica',
          confianca: 0.9
        };
      } else if (ojsCidade.length > 1) {
        // Múltiplos OJs da cidade, verificar número da vara
        const numeroMatch = nomeNormalizado.match(/^(\d+)ª/);
        if (numeroMatch) {
          const numero = numeroMatch[1];
          for (const oj of ojsCidade) {
            if (oj.startsWith(`${numero}ª`)) {
              return {
                encontrado: true,
                original: nomeOJ,
                normalizado: nomeNormalizado,
                correspondencia: oj,
                tipo: 'cidade_numero',
                confianca: 0.95
              };
            }
          }
        }
        
        // Se não tem número ou não encontrou, retornar primeira vara
        const primeiraVara = ojsCidade.find(oj => !oj.match(/^\d+ª/)) || ojsCidade[0];
        return {
          encontrado: true,
          original: nomeOJ,
          normalizado: nomeNormalizado,
          correspondencia: primeiraVara,
          tipo: 'cidade_primeira',
          confianca: 0.7
        };
      }
    }
    
    // Busca por similaridade como último recurso
    let melhorCorrespondencia = null;
    let melhorSimilaridade = 0;
    
    for (const oj of listaOJs) {
      const similaridade = this.calcularSimilaridade(
        nomeNormalizado.toLowerCase(),
        oj.toLowerCase()
      );
      
      if (similaridade > melhorSimilaridade && similaridade > 0.6) {
        melhorSimilaridade = similaridade;
        melhorCorrespondencia = oj;
      }
    }
    
    if (melhorCorrespondencia) {
      return {
        encontrado: true,
        original: nomeOJ,
        normalizado: nomeNormalizado,
        correspondencia: melhorCorrespondencia,
        tipo: 'similaridade',
        confianca: melhorSimilaridade
      };
    }
    
    // Não encontrou correspondência
    return {
      encontrado: false,
      original: nomeOJ,
      normalizado: nomeNormalizado,
      correspondencia: null,
      tipo: 'nao_encontrado',
      confianca: 0
    };
  }

  /**
   * Corrige uma lista de OJs
   */
  corrigirLista(listaOJs, ojsDisponiveis) {
    const resultado = {
      corrigidos: [],
      problemas: [],
      total: listaOJs.length,
      sucessos: 0,
      falhas: 0
    };
    
    for (const ojOriginal of listaOJs) {
      const correspondencia = this.encontrarMelhorCorrespondencia(ojOriginal, ojsDisponiveis);
      
      if (correspondencia.encontrado && correspondencia.confianca >= 0.7) {
        resultado.corrigidos.push({
          original: ojOriginal,
          corrigido: correspondencia.correspondencia,
          tipo: correspondencia.tipo,
          confianca: correspondencia.confianca
        });
        resultado.sucessos++;
      } else {
        resultado.problemas.push({
          original: ojOriginal,
          normalizado: correspondencia.normalizado,
          sugestao: correspondencia.correspondencia,
          tipo: correspondencia.tipo,
          confianca: correspondencia.confianca
        });
        resultado.falhas++;
      }
    }
    
    return resultado;
  }
}

module.exports = OJIntelligentNormalizer;