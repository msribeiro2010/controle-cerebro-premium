const { Logger } = require('./Logger');
const { NormalizadorTexto } = require('./normalizacao');

/**
 * Sistema de verificação integrada de OJ + Papel/Perfil
 * Resolve o problema de pular OJs com papéis diferentes
 */
class VerificacaoOJPapel {
  constructor() {
    this.logger = new Logger('VerificacaoOJPapel');
    this.cacheVerificacoes = new Map(); // Cache: `ojNormalizado:papel` → resultado
    this.estatisticas = {
      verificacoesTotais: 0,
      ojsComPapelDiferente: 0,
      ojsJaVinculadosCorretamente: 0,
      ojsParaVincular: 0
    };
  }

  /**
   * Verifica se OJ já está vinculado com o papel específico
   * @param {Object} page - Página do Playwright
   * @param {string} nomeOJ - Nome do órgão julgador
   * @param {string} papelDesejado - Papel/perfil desejado
   * @returns {Object} Resultado da verificação
   */
  async verificarOJComPapel(page, nomeOJ, papelDesejado) {
    const inicioTempo = Date.now();
    const chaveCache = this._criarChaveCache(nomeOJ, papelDesejado);
    
    // Verificar cache primeiro
    if (this.cacheVerificacoes.has(chaveCache)) {
      const resultado = this.cacheVerificacoes.get(chaveCache);
      this.logger.info(`🎯 Cache hit para ${nomeOJ} + ${papelDesejado}`);
      return resultado;
    }

    const resultado = {
      jaVinculado: false,
      papelCorreto: false,
      papelExistente: null,
      podeVincular: true,
      motivo: '',
      tempoVerificacao: 0,
      detalhes: {
        ojEncontrado: false,
        papelEncontrado: false,
        elementoEncontrado: null,
        debugInfo: []
      }
    };

    try {
      this.logger.info(`🔍 Verificando OJ "${nomeOJ}" com papel "${papelDesejado}"`);
      
      // Aguardar um momento para página carregar completamente
      await page.waitForTimeout(1000);
      
      // Etapa 1: Verificação direta usando método antigo como fallback
      const verificacaoAntiga = await this._verificacaoFallbackAntiga(page, nomeOJ);
      
      if (verificacaoAntiga.encontrado) {
        resultado.jaVinculado = true;
        resultado.detalhes.ojEncontrado = true;
        resultado.detalhes.debugInfo.push('OJ encontrado via método fallback');
        
        // Se encontrou via método antigo, usar verificação robusta de papel
        const infoPapel = await this._verificarPapelRobusta(page, nomeOJ, papelDesejado);
        
        resultado.papelExistente = infoPapel.papelAtual;
        resultado.papelCorreto = infoPapel.papelCorreto;
        resultado.detalhes.papelEncontrado = infoPapel.papelEncontrado;
        resultado.detalhes.debugInfo.push(`Papel detectado: "${infoPapel.papelAtual}"`);
        
        if (infoPapel.papelCorreto) {
          resultado.podeVincular = false;
          resultado.motivo = `OJ já vinculado com papel "${papelDesejado}"`;
          this.estatisticas.ojsJaVinculadosCorretamente++;
        } else if (infoPapel.papelEncontrado && infoPapel.papelAtual) {
          resultado.podeVincular = true;
          resultado.motivo = `OJ vinculado com papel diferente ("${infoPapel.papelAtual}" → "${papelDesejado}")`;
          this.estatisticas.ojsComPapelDiferente++;
        } else {
          // OJ encontrado mas papel não detectado - pode vincular por segurança
          resultado.podeVincular = true;
          resultado.motivo = 'OJ encontrado mas papel não detectado - pode vincular';
          this.estatisticas.ojsParaVincular++;
        }
      } else {
        resultado.podeVincular = true;
        resultado.motivo = 'OJ não está vinculado';
        resultado.detalhes.debugInfo.push('OJ não encontrado via método fallback');
        this.estatisticas.ojsParaVincular++;
      }
      
    } catch (error) {
      this.logger.error(`❌ Erro na verificação de ${nomeOJ}: ${error.message}`);
      resultado.podeVincular = true;
      resultado.motivo = `Erro na verificação: ${error.message}`;
      resultado.detalhes.debugInfo.push(`Erro: ${error.message}`);
    }

    resultado.tempoVerificacao = Date.now() - inicioTempo;
    this.estatisticas.verificacoesTotais++;
    
    // Armazenar no cache
    this.cacheVerificacoes.set(chaveCache, resultado);
    
    this.logger.info(`📊 Resultado: ${resultado.podeVincular ? 'PODE VINCULAR' : 'PULAR'} - ${resultado.motivo}`);
    this.logger.info(`🔍 Debug: ${JSON.stringify(resultado.detalhes.debugInfo)}`);
    
    return resultado;
  }

  /**
   * Busca todas as linhas que podem conter OJs vinculados
   * @param {Object} page - Página do Playwright
   * @returns {Array} Lista de elementos encontrados
   */
  async _buscarLinhasOJ(page) {
    const seletoresTabela = [
      'table tbody tr',
      '.mat-table .mat-row',
      '.table tbody tr',
      '.data-table tr',
      'tbody tr',
      '.list-item',
      '.orgao-item',
      '.vinculo-item'
    ];
    
    const linhasEncontradas = [];
    
    for (const seletor of seletoresTabela) {
      try {
        const elementos = await page.locator(seletor).all();
        linhasEncontradas.push(...elementos);
      } catch (error) {
        // Continuar com próximo seletor
      }
    }
    
    this.logger.info(`🔍 Encontradas ${linhasEncontradas.length} linhas para análise`);
    return linhasEncontradas;
  }

  /**
   * Procura pelo OJ específico nas linhas encontradas
   * @param {Array} linhas - Lista de elementos de linha
   * @param {string} nomeOJ - Nome do OJ procurado
   * @returns {Object} Informações sobre o OJ encontrado
   */
  async _procurarOJNasLinhas(linhas, nomeOJ) {
    const nomeOJNormalizado = NormalizadorTexto.normalizar(nomeOJ);
    
    for (const linha of linhas) {
      try {
        const textoLinha = await linha.textContent();
        if (!textoLinha || !textoLinha.trim()) continue;
        
        const textoNormalizado = NormalizadorTexto.normalizar(textoLinha);
        
        // Verificação por similaridade alta
        if (NormalizadorTexto.saoEquivalentes(nomeOJ, textoLinha, 0.95) ||
            textoNormalizado.includes(nomeOJNormalizado) ||
            nomeOJNormalizado.includes(textoNormalizado)) {
          
          this.logger.info(`✅ OJ encontrado: "${textoLinha.trim()}"`);
          return {
            encontrado: true,
            elemento: linha,
            textoCompleto: textoLinha.trim()
          };
        }
      } catch (error) {
        // Continuar para próxima linha
        continue;
      }
    }
    
    return { encontrado: false, elemento: null, textoCompleto: null };
  }

  /**
   * Verifica o papel associado ao OJ encontrado
   * @param {Object} elementoOJ - Elemento da linha do OJ
   * @param {string} papelDesejado - Papel desejado
   * @returns {Object} Informações sobre o papel
   */
  async _verificarPapelDoOJ(elementoOJ, papelDesejado) {
    const papelDesejadoNormalizado = NormalizadorTexto.normalizar(papelDesejado);
    
    try {
      // Estratégias para encontrar papel/perfil na mesma linha ou próximas células
      const seletoresPapel = [
        'td', // Células da mesma linha
        '.papel', '.perfil', '.role', '.cargo',
        'span', 'div',
        '[class*="papel"]', '[class*="perfil"]', '[class*="role"]'
      ];
      
      let papelEncontrado = null;
      
      // Buscar papel na mesma linha
      for (const seletor of seletoresPapel) {
        try {
          const elementos = await elementoOJ.locator(seletor).all();
          
          for (const elemento of elementos) {
            const texto = await elemento.textContent();
            if (!texto || !texto.trim()) continue;
            
            const textoLimpo = texto.trim();
            
            // Verificar se parece ser um papel/perfil
            if (this._parecePapel(textoLimpo)) {
              papelEncontrado = textoLimpo;
              break;
            }
          }
          
          if (papelEncontrado) break;
        } catch (error) {
          continue;
        }
      }
      
      // Se não encontrou papel específico, tentar extrair do texto completo da linha
      if (!papelEncontrado) {
        const textoCompleto = await elementoOJ.textContent();
        papelEncontrado = this._extrairPapelDoTexto(textoCompleto);
      }
      
      if (!papelEncontrado) {
        this.logger.warn('⚠️ Papel não encontrado para o OJ');
        return {
          papelEncontrado: false,
          papelAtual: null,
          papelCorreto: false
        };
      }
      
      // Comparar papéis
      const papelAtualNormalizado = NormalizadorTexto.normalizar(papelEncontrado);
      const papelCorreto = NormalizadorTexto.saoEquivalentes(papelDesejado, papelEncontrado, 0.85);
      
      this.logger.info(`📋 Papel atual: "${papelEncontrado}" | Desejado: "${papelDesejado}" | Match: ${papelCorreto}`);
      
      return {
        papelEncontrado: true,
        papelAtual: papelEncontrado,
        papelCorreto
      };
      
    } catch (error) {
      this.logger.warn(`⚠️ Erro ao verificar papel: ${error.message}`);
      return {
        papelEncontrado: false,
        papelAtual: null,
        papelCorreto: false
      };
    }
  }

  /**
   * Verifica se um texto parece ser um papel/perfil
   * @param {string} texto - Texto a verificar
   * @returns {boolean} Se parece ser papel
   */
  _parecePapel(texto) {
    if (!texto || texto.length < 5 || texto.length > 50) return false;
    
    const palavrasChavePapel = [
      'secretário', 'secretaria', 'assessor', 'analista', 'técnico',
      'auxiliar', 'escrivão', 'oficial', 'diretor', 'chefe',
      'coordenador', 'supervisor', 'gerente', 'audiência',
      'estagiário', 'conhecimento', 'aprendizado', 'formação'
    ];
    
    const textoNormalizado = NormalizadorTexto.normalizar(texto);
    
    return palavrasChavePapel.some(palavra => textoNormalizado.includes(palavra));
  }

  /**
   * Extrai papel do texto completo usando padrões
   * @param {string} textoCompleto - Texto completo para análise
   * @returns {string|null} Papel extraído ou null
   */
  _extrairPapelDoTexto(textoCompleto) {
    if (!textoCompleto) return null;
    
    // Padrões comuns para encontrar papéis
    const padroes = [
      /(?:papel|perfil|cargo|função):\s*([^,\n\t-]+)/i,
      /(secretário[^,\n\t-]*)/i,
      /(assessor[^,\n\t-]*)/i,
      /(analista[^,\n\t-]*)/i,
      /(técnico[^,\n\t-]*)/i,
      /(auxiliar[^,\n\t-]*)/i,
      /(escrivão[^,\n\t-]*)/i,
      /(estagiário[^,\n\t-]*)/i,
      /(conhecimento[^,\n\t-]*)/i
    ];
    
    for (const padrao of padroes) {
      const match = textoCompleto.match(padrao);
      if (match && match[1]) {
        const papel = match[1].trim();
        if (this._parecePapel(papel)) {
          return papel;
        }
      }
    }
    
    return null;
  }

  /**
   * Cria chave para cache baseada em OJ + papel
   * @param {string} nomeOJ - Nome do OJ
   * @param {string} papel - Papel/perfil
   * @returns {string} Chave do cache
   */
  _criarChaveCache(nomeOJ, papel) {
    const ojNormalizado = NormalizadorTexto.normalizar(nomeOJ);
    const papelNormalizado = NormalizadorTexto.normalizar(papel);
    return `${ojNormalizado}:${papelNormalizado}`;
  }

  /**
   * Processa lista de OJs verificando papel para cada um
   * @param {Object} page - Página do Playwright
   * @param {Array} ojs - Lista de OJs
   * @param {string} papelDesejado - Papel desejado
   * @param {Function} progressCallback - Callback de progresso
   * @returns {Object} Resultado do processamento
   */
  async verificarLoteOJsComPapel(page, ojs, papelDesejado, progressCallback = null) {
    const resultado = {
      ojsVerificados: [],
      ojsJaVinculadosCorretos: [],
      ojsComPapelDiferente: [],
      ojsParaVincular: [],
      estatisticas: {
        total: ojs.length,
        jaVinculadosCorretos: 0,
        comPapelDiferente: 0,
        paraVincular: 0,
        tempoTotalMs: 0
      }
    };

    const inicioTempo = Date.now();

    for (let i = 0; i < ojs.length; i++) {
      const oj = ojs[i];
      
      if (progressCallback) {
        const progresso = Math.round(((i + 1) / ojs.length) * 100);
        progressCallback(`🔍 Verificando ${oj} (papel: ${papelDesejado})`, progresso);
      }

      const verificacao = await this.verificarOJComPapel(page, oj, papelDesejado);
      
      const itemResultado = {
        oj,
        papelDesejado,
        jaVinculado: verificacao.jaVinculado,
        papelCorreto: verificacao.papelCorreto,
        papelExistente: verificacao.papelExistente,
        podeVincular: verificacao.podeVincular,
        motivo: verificacao.motivo
      };

      resultado.ojsVerificados.push(itemResultado);

      if (verificacao.jaVinculado && verificacao.papelCorreto) {
        resultado.ojsJaVinculadosCorretos.push(itemResultado);
        resultado.estatisticas.jaVinculadosCorretos++;
      } else if (verificacao.jaVinculado && !verificacao.papelCorreto) {
        resultado.ojsComPapelDiferente.push(itemResultado);
        resultado.estatisticas.comPapelDiferente++;
      } else {
        resultado.ojsParaVincular.push(itemResultado);
        resultado.estatisticas.paraVincular++;
      }

      // Pequena pausa entre verificações
      await page.waitForTimeout(100);
    }

    resultado.estatisticas.tempoTotalMs = Date.now() - inicioTempo;

    this.logger.info('✅ Verificação em lote concluída:');
    this.logger.info(`   - Total: ${resultado.estatisticas.total}`);
    this.logger.info(`   - Já vinculados (papel correto): ${resultado.estatisticas.jaVinculadosCorretos}`);
    this.logger.info(`   - Com papel diferente: ${resultado.estatisticas.comPapelDiferente}`);
    this.logger.info(`   - Para vincular: ${resultado.estatisticas.paraVincular}`);

    return resultado;
  }

  /**
   * Gera relatório das estatísticas
   * @returns {Object} Relatório
   */
  gerarRelatorio() {
    return {
      verificacoesTotais: this.estatisticas.verificacoesTotais,
      ojsJaVinculadosCorretamente: this.estatisticas.ojsJaVinculadosCorretamente,
      ojsComPapelDiferente: this.estatisticas.ojsComPapelDiferente,
      ojsParaVincular: this.estatisticas.ojsParaVincular,
      taxaAproveitamento: this.estatisticas.verificacoesTotais > 0 
        ? (this.estatisticas.ojsJaVinculadosCorretamente / this.estatisticas.verificacoesTotais) * 100 
        : 0
    };
  }

  /**
   * Verificação fallback usando método melhorado
   * @param {Object} page - Página do Playwright
   * @param {string} nomeOJ - Nome do OJ
   * @returns {Object} Resultado da verificação
   */
  async _verificacaoFallbackAntiga(page, nomeOJ) {
    try {
      // Primeiro tentar método antigo
      const { verificarOJJaVinculado } = require('../verificarOJVinculado');
      const resultadoAntigo = await verificarOJJaVinculado(page, nomeOJ);
      
      if (resultadoAntigo.jaVinculado) {
        return {
          encontrado: true,
          elemento: resultadoAntigo.elemento || null,
          texto: resultadoAntigo.textoEncontrado || null
        };
      }
      
      // Se método antigo não encontrou, usar busca melhorada
      const encontradoMelhorado = await this._buscarOJMelhorado(page, nomeOJ);
      return encontradoMelhorado;
      
    } catch (error) {
      this.logger.warn(`⚠️ Fallback antigo falhou: ${error.message}`);
      
      // Usar busca melhorada como último recurso
      try {
        return await this._buscarOJMelhorado(page, nomeOJ);
      } catch (error2) {
        return {
          encontrado: false,
          elemento: null,
          texto: null
        };
      }
    }
  }

  /**
   * Busca melhorada de OJ na página
   * @param {Object} page - Página do Playwright
   * @param {string} nomeOJ - Nome do OJ
   * @returns {Object} Resultado da busca
   */
  async _buscarOJMelhorado(page, nomeOJ) {
    const nomeOJNormalizado = this._normalizarTexto(nomeOJ);
    
    // Estratégia 1: Buscar em elementos de tabela
    const seletoresTabela = [
      'table tr td',
      'table tbody tr td',
      '.mat-table .mat-row .mat-cell',
      '.data-table tr td',
      'tr td'
    ];
    
    for (const seletor of seletoresTabela) {
      try {
        const elementos = await page.locator(seletor).all();
        
        for (const elemento of elementos) {
          const texto = await elemento.textContent();
          if (texto && this._textoContemOJ(texto, nomeOJ)) {
            return {
              encontrado: true,
              elemento,
              texto: texto.trim()
            };
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    // Estratégia 2: Buscar em divs e spans
    const seletoresGenericos = [
      'div',
      'span',
      'p',
      '.oj-item',
      '.lista-ojs',
      '[class*="oj"]',
      '[class*="vara"]',
      '[class*="tribunal"]'
    ];
    
    for (const seletor of seletoresGenericos) {
      try {
        const elementos = await page.locator(seletor).all();
        
        for (const elemento of elementos) {
          const texto = await elemento.textContent();
          if (texto && this._textoContemOJ(texto, nomeOJ)) {
            return {
              encontrado: true,
              elemento,
              texto: texto.trim()
            };
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    // Estratégia 3: Buscar no conteúdo completo da página
    try {
      const conteudoCompleto = await page.textContent('body');
      if (conteudoCompleto && this._textoContemOJ(conteudoCompleto, nomeOJ)) {
        return {
          encontrado: true,
          elemento: null,
          texto: this._encontrarLinhaComOJ(conteudoCompleto, nomeOJ)
        };
      }
    } catch (e) {
      // Continuar
    }
    
    return {
      encontrado: false,
      elemento: null,
      texto: null
    };
  }

  /**
   * Busca em elementos HTML estruturados (tabelas, divs específicos)
   * @param {Object} page - Página do Playwright
   * @param {string} nomeOJ - Nome do OJ
   * @param {string} papelDesejado - Papel desejado
   * @returns {Object} Resultado da busca
   */
  async _buscarEmElementosEstruturados(page, nomeOJ, papelDesejado) {
    try {
      // Buscar em elementos .oj-vinculado (estrutura específica do teste)
      const elementosOJVinculado = await page.locator('.oj-vinculado').all();
      
      for (const elemento of elementosOJVinculado) {
        try {
          const nomeOJElement = await elemento.locator('.nome-oj, .oj-nome').first();
          const papelElement = await elemento.locator('.papel, .perfil').first();
          
          const nomeOJTexto = await nomeOJElement.textContent();
          const papelTexto = await papelElement.textContent();
          
          if (nomeOJTexto && this._textoContemOJ(nomeOJTexto, nomeOJ)) {
            const papelExtraido = papelTexto ? papelTexto.trim() : null;
            if (papelExtraido && this._parecePapel(papelExtraido)) {
              const papelCorreto = this._compararPapeis(papelExtraido, papelDesejado);
              return {
                papelEncontrado: true,
                papelAtual: papelExtraido,
                papelCorreto
              };
            }
          }
        } catch (e) {
          continue;
        }
      }
      
      // Buscar em linhas de tabela com células específicas
      const linhasTabela = await page.locator('table tr').all();
      
      for (const linha of linhasTabela) {
        try {
          const celulas = await linha.locator('td, th').all();
          
          let celulaOJ = null;
          let celulaPapel = null;
          
          // Procurar célula que contém o OJ
          for (let i = 0; i < celulas.length; i++) {
            const textoCelula = await celulas[i].textContent();
            if (textoCelula && this._textoContemOJ(textoCelula, nomeOJ)) {
              celulaOJ = i;
              // O papel geralmente está na próxima célula
              if (i + 1 < celulas.length) {
                celulaPapel = i + 1;
              }
              break;
            }
          }
          
          if (celulaOJ !== null && celulaPapel !== null) {
            const papelTexto = await celulas[celulaPapel].textContent();
            const papelExtraido = papelTexto ? papelTexto.trim() : null;
            
            if (papelExtraido && this._parecePapel(papelExtraido)) {
              const papelCorreto = this._compararPapeis(papelExtraido, papelDesejado);
              return {
                papelEncontrado: true,
                papelAtual: papelExtraido,
                papelCorreto
              };
            }
          }
        } catch (e) {
          continue;
        }
      }
      
    } catch (error) {
      // Falhou, continuar com outras estratégias
    }
    
    return {
      papelEncontrado: false,
      papelAtual: null,
      papelCorreto: false
    };
  }

  /**
   * Verificação robusta de papel usando múltiplas estratégias
   * @param {Object} page - Página do Playwright
   * @param {string} nomeOJ - Nome do OJ
   * @param {string} papelDesejado - Papel desejado
   * @returns {Object} Informações sobre o papel
   */
  async _verificarPapelRobusta(page, nomeOJ, papelDesejado) {
    const papelDesejadoNormalizado = this._normalizarTexto(papelDesejado);
    
    try {
      // Estratégia 1: Buscar em todo o conteúdo da página por padrões
      const conteudoPagina = await page.textContent('body');
      const linhaMasCaracteristica = this._encontrarLinhaComOJ(conteudoPagina, nomeOJ);
      
      if (linhaMasCaracteristica) {
        const papelExtraido = this._extrairPapelDaLinha(linhaMasCaracteristica);
        if (papelExtraido) {
          const papelCorreto = this._compararPapeis(papelExtraido, papelDesejado);
          return {
            papelEncontrado: true,
            papelAtual: papelExtraido,
            papelCorreto
          };
        }
      }

      // Estratégia 2: Buscar em elementos estruturados específicos
      const resultadoEstruturado = await this._buscarEmElementosEstruturados(page, nomeOJ, papelDesejado);
      if (resultadoEstruturado.papelEncontrado) {
        return resultadoEstruturado;
      }

      // Estratégia 3: Buscar em tabelas e elementos de linha
      const elementosTabela = await page.locator('table tr, .mat-row, .data-row').all();
      
      for (const elemento of elementosTabela) {
        try {
          const textoElemento = await elemento.textContent();
          if (textoElemento && this._textoContemOJ(textoElemento, nomeOJ)) {
            const papelExtraido = this._extrairPapelDaLinha(textoElemento);
            if (papelExtraido) {
              const papelCorreto = this._compararPapeis(papelExtraido, papelDesejado);
              return {
                papelEncontrado: true,
                papelAtual: papelExtraido,
                papelCorreto
              };
            }
          }
        } catch (e) {
          continue;
        }
      }
      
      // Estratégia 3: Busca por seletores específicos de papel
      const seletoresPapel = [
        '[class*="perfil"]',
        '[class*="papel"]', 
        '[class*="role"]',
        '[class*="cargo"]',
        'td:nth-child(2)', // Segunda coluna geralmente é papel
        'td:nth-child(3)', // Terceira coluna pode ser papel
        '.mat-cell:nth-child(2)',
        '.mat-cell:nth-child(3)'
      ];
      
      for (const seletor of seletoresPapel) {
        try {
          const elementos = await page.locator(seletor).all();
          for (const elemento of elementos) {
            const texto = await elemento.textContent();
            if (texto && this._parecePapel(texto.trim())) {
              const papelCorreto = this._compararPapeis(texto.trim(), papelDesejado);
              if (papelCorreto || this._parecePapelRelevante(texto.trim())) {
                return {
                  papelEncontrado: true,
                  papelAtual: texto.trim(),
                  papelCorreto
                };
              }
            }
          }
        } catch (e) {
          continue;
        }
      }
      
      return {
        papelEncontrado: false,
        papelAtual: null,
        papelCorreto: false
      };
      
    } catch (error) {
      this.logger.warn(`⚠️ Erro na verificação robusta de papel: ${error.message}`);
      return {
        papelEncontrado: false,
        papelAtual: null,
        papelCorreto: false
      };
    }
  }

  /**
   * Encontra linha que contém o OJ específico
   * @param {string} conteudo - Conteúdo da página
   * @param {string} nomeOJ - Nome do OJ
   * @returns {string|null} Linha encontrada ou null
   */
  _encontrarLinhaComOJ(conteudo, nomeOJ) {
    if (!conteudo) return null;
    
    const linhas = conteudo.split('\n');
    const nomeOJNormalizado = this._normalizarTexto(nomeOJ);
    
    for (const linha of linhas) {
      const linhaNormalizada = this._normalizarTexto(linha);
      if (linhaNormalizada.includes(nomeOJNormalizado) || 
          this._similaridade(linhaNormalizada, nomeOJNormalizado) > 0.8) {
        return linha.trim();
      }
    }
    
    return null;
  }

  /**
   * Verifica se texto contém o OJ
   * @param {string} texto - Texto a verificar
   * @param {string} nomeOJ - Nome do OJ
   * @returns {boolean} Se contém o OJ
   */
  _textoContemOJ(texto, nomeOJ) {
    if (!texto || !nomeOJ) return false;
    
    const textoNormalizado = this._normalizarTexto(texto);
    const nomeOJNormalizado = this._normalizarTexto(nomeOJ);
    
    // Verificação por inclusão direta
    if (textoNormalizado.includes(nomeOJNormalizado)) return true;
    
    // Verificação por inclusão reversa (OJ contém parte do texto)
    if (nomeOJNormalizado.includes(textoNormalizado) && textoNormalizado.length > 5) return true;
    
    // Verificação por palavras-chave comuns
    const palavrasOJ = nomeOJNormalizado.split(' ').filter(p => p.length > 2);
    const palavrasTexto = textoNormalizado.split(' ').filter(p => p.length > 2);
    
    if (palavrasOJ.length > 0 && palavrasTexto.length > 0) {
      const palavrasComuns = palavrasOJ.filter(p => palavrasTexto.includes(p));
      if (palavrasComuns.length >= Math.min(2, palavrasOJ.length)) return true;
    }
    
    // Verificação por similaridade
    if (this._similaridade(textoNormalizado, nomeOJNormalizado) > 0.7) return true;
    
    return false;
  }

  /**
   * Extrai papel de uma linha de texto
   * @param {string} linha - Linha de texto
   * @returns {string|null} Papel extraído ou null
   */
  _extrairPapelDaLinha(linha) {
    if (!linha) return null;
    
    // Padrões mais específicos para PJE
    const padroes = [
      // Formato: "Nome - Papel - OJ"
      /([^-\n]+)(?:\s*-\s*)([^-\n]*(?:secretário|assessor|analista|técnico|auxiliar|escrivão)[^-\n]*)/i,
      // Formato: "OJ - Papel"
      /(?:vara|tribunal|juizado)[^-\n]*-\s*([^-\n]*(?:secretário|assessor|analista|técnico|auxiliar)[^-\n]*)/i,
      // Palavras-chave diretas
      /(secretário[^,\n\t-]*de\s+audiência)/i,
      /(secretário[^,\n\t-]*)/i,
      /(assessor[^,\n\t-]*)/i,
      /(analista[^,\n\t-]*judiciário)/i,
      /(analista[^,\n\t-]*)/i,
      /(técnico[^,\n\t-]*judiciário)/i,
      /(auxiliar[^,\n\t-]*judiciário)/i,
      /(escrivão[^,\n\t-]*)/i
    ];
    
    for (const padrao of padroes) {
      const match = linha.match(padrao);
      if (match) {
        const papel = match[1] || match[2];
        if (papel && this._parecePapel(papel.trim())) {
          return papel.trim();
        }
      }
    }
    
    return null;
  }

  /**
   * Verifica se texto parece ser um papel relevante
   * @param {string} texto - Texto a verificar
   * @returns {boolean} Se parece papel relevante
   */
  _parecePapelRelevante(texto) {
    if (!texto) return false;
    
    const textoNormalizado = this._normalizarTexto(texto);
    
    // Lista de papéis comuns no sistema judiciário
    const papeisComuns = [
      'secretário de audiência',
      'secretário',
      'assessor',
      'analista judiciário',
      'técnico judiciário',
      'auxiliar judiciário',
      'escrivão'
    ];
    
    return papeisComuns.some(papel => textoNormalizado.includes(papel));
  }

  /**
   * Compara dois papéis para verificar se são equivalentes
   * @param {string} papel1 - Primeiro papel
   * @param {string} papel2 - Segundo papel
   * @returns {boolean} Se são equivalentes
   */
  _compararPapeis(papel1, papel2) {
    if (!papel1 || !papel2) return false;
    
    const p1 = this._normalizarTexto(papel1);
    const p2 = this._normalizarTexto(papel2);
    
    // Log de debug para comparação
    console.log(`🔍 [COMPARAR PAPÉIS] "${papel1}" VS "${papel2}"`);
    console.log(`🔍 [NORMALIZADO] "${p1}" VS "${p2}"`);
    
    // Comparação exata
    if (p1 === p2) {
      console.log('✅ [MATCH EXATO] Papéis idênticos após normalização');
      return true;
    }
    
    // Comparação por similaridade alta
    const similaridade = this._similaridade(p1, p2);
    console.log(`📊 [SIMILARIDADE] ${(similaridade * 100).toFixed(1)}%`);
    
    if (similaridade >= 0.85) {
      console.log('✅ [MATCH SIMILARIDADE] Papéis similares (≥85%)');
      return true;
    }
    
    // Comparações específicas para papéis comuns
    const equivalencias = {
      'secretario': ['secretario', 'secretaria', 'secretario de audiencia'],
      'secretario de audiencia': ['secretario', 'secretaria', 'secretario de audiencia'],
      'assessor': ['assessora'],
      'analista': ['analista judiciario'],
      'analista judiciario': ['analista'],
      'tecnico': ['tecnico judiciario'],
      'tecnico judiciario': ['tecnico'],
    };
    
    for (const [base, variants] of Object.entries(equivalencias)) {
      if ((p1.includes(base) || base.includes(p1)) && 
          variants.some(v => p2.includes(v) || v.includes(p2))) {
        console.log(`✅ [MATCH EQUIVALÊNCIA] "${base}" equivale a variantes`);
        return true;
      }
      if ((p2.includes(base) || base.includes(p2)) && 
          variants.some(v => p1.includes(v) || v.includes(p1))) {
        console.log(`✅ [MATCH EQUIVALÊNCIA] "${base}" equivale a variantes (reverso)`);
        return true;
      }
    }
    
    console.log('❌ [NO MATCH] Papéis são diferentes');
    return false;
  }

  /**
   * Calcula similaridade entre dois textos
   * @param {string} texto1 - Primeiro texto
   * @param {string} texto2 - Segundo texto
   * @returns {number} Similaridade entre 0 e 1
   */
  _similaridade(texto1, texto2) {
    if (!texto1 || !texto2) return 0;
    
    const len1 = texto1.length;
    const len2 = texto2.length;
    const maxLen = Math.max(len1, len2);
    
    if (maxLen === 0) return 1;
    
    // Distância de Levenshtein simplificada
    const matrix = Array(len2 + 1).fill().map(() => Array(len1 + 1).fill(0));
    
    for (let i = 0; i <= len1; i++) matrix[0][i] = i;
    for (let j = 0; j <= len2; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= len2; j++) {
      for (let i = 1; i <= len1; i++) {
        const cost = texto1[i - 1] === texto2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j - 1][i] + 1,     // deletion
          matrix[j][i - 1] + 1,     // insertion
          matrix[j - 1][i - 1] + cost // substitution
        );
      }
    }
    
    const distance = matrix[len2][len1];
    return (maxLen - distance) / maxLen;
  }

  /**
   * Normaliza texto para comparação
   * @param {string} texto - Texto a normalizar
   * @returns {string} Texto normalizado
   */
  _normalizarTexto(texto) {
    if (!texto) return '';
    
    return texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^\w\s]/g, ' ')        // Remove pontuação
      .replace(/\s+/g, ' ')           // Normaliza espaços
      .trim();
  }

  /**
   * Limpa cache de verificações
   */
  limparCache() {
    this.cacheVerificacoes.clear();
    this.logger.info('🧹 Cache de verificações limpo');
  }
}

module.exports = { VerificacaoOJPapel };