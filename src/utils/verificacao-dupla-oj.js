const { Logger } = require('./Logger');
const { verificarOJJaVinculado } = require('../verificarOJVinculado');

/**
 * Sistema de verificação dupla para OJs já vinculados
 * Funciona como uma camada extra de segurança além do cache inteligente
 */
class VerificacaoDuplaOJ {
  constructor() {
    this.logger = new Logger('VerificacaoDuplaOJ');
    this.verificacoesRealizadas = new Map(); // Map<ojNormalizado, { resultado, timestamp }>
    this.estatisticas = {
      totalVerificacoes: 0,
      cacheHits: 0,
      verificacoesDiretas: 0,
      ojsDetectadosJaVinculados: 0,
      falsoPositivos: 0,
      tempoTotalMs: 0
    };
  }

  /**
   * Verifica se um OJ já está vinculado usando verificação dupla
   * @param {Object} page - Página do Playwright
   * @param {string} oj - Nome do OJ
   * @param {Object} smartOJCache - Cache inteligente
   * @param {boolean} forcarVerificacao - Força verificação mesmo se estiver no cache
   * @returns {Object} Resultado da verificação
   */
  async verificarOJDupla(page, oj, smartOJCache, forcarVerificacao = false) {
    const inicioTempo = Date.now();
    const ojNormalizado = this._normalizarOJ(oj);
    
    const resultado = {
      jaVinculado: false,
      metodoDeteccao: '',
      confiabilidade: 0,
      tempoVerificacao: 0,
      detalhes: {
        cacheResult: null,
        verificacaoDireta: null,
        consenso: false
      }
    };

    try {
      // Etapa 1: Verificar cache inteligente
      const cacheResult = smartOJCache.isOJVinculado(oj);
      resultado.detalhes.cacheResult = cacheResult;
      
      // Etapa 2: Verificar cache local de verificações recentes
      const verificacaoRecente = this.verificacoesRealizadas.get(ojNormalizado);
      const tempoLimite = 5 * 60 * 1000; // 5 minutos
      
      if (verificacaoRecente && !forcarVerificacao && 
          (Date.now() - verificacaoRecente.timestamp) < tempoLimite) {
        
        this.estatisticas.cacheHits++;
        resultado.jaVinculado = verificacaoRecente.resultado;
        resultado.metodoDeteccao = 'cache_local';
        resultado.confiabilidade = 0.9;
        
        this.logger.info(`🎯 Cache local hit para OJ: ${oj}`);
        return resultado;
      }

      // Etapa 3: Verificação direta se necessário
      let verificacaoDireta = null;
      
      // Condições para verificação direta:
      // 1. Cache não tem informação
      // 2. Forçar verificação
      // 3. Verificação de segurança aleatória (5% dos casos)
      const deveVerificarDiretamente = 
        !cacheResult || 
        forcarVerificacao || 
        (Math.random() < 0.05 && cacheResult); // 5% de verificações de segurança
      
      if (deveVerificarDiretamente) {
        this.logger.info(`🔍 Realizando verificação direta para OJ: ${oj}`);
        
        try {
          verificacaoDireta = await verificarOJJaVinculado(page, oj);
          resultado.detalhes.verificacaoDireta = verificacaoDireta;
          this.estatisticas.verificacoesDiretas++;
          
        } catch (verificacaoError) {
          this.logger.warn(`⚠️ Erro na verificação direta de ${oj}: ${verificacaoError.message}`);
          verificacaoDireta = { jaVinculado: false, erro: verificacaoError.message };
        }
      }

      // Etapa 4: Análise de consenso
      const analiseConsenso = this._analisarConsenso(cacheResult, verificacaoDireta);
      
      resultado.jaVinculado = analiseConsenso.jaVinculado;
      resultado.metodoDeteccao = analiseConsenso.metodo;
      resultado.confiabilidade = analiseConsenso.confiabilidade;
      resultado.detalhes.consenso = analiseConsenso.consenso;

      // Etapa 5: Detectar inconsistências
      if (cacheResult && verificacaoDireta && 
          cacheResult !== verificacaoDireta.jaVinculado) {
        
        this.estatisticas.falsoPositivos++;
        this.logger.warn(`⚠️ INCONSISTÊNCIA DETECTADA para OJ: ${oj}`);
        this.logger.warn(`   - Cache: ${cacheResult}`);
        this.logger.warn(`   - Verificação direta: ${verificacaoDireta.jaVinculado}`);
        
        // Atualizar cache com resultado da verificação direta
        if (verificacaoDireta.jaVinculado) {
          smartOJCache.adicionarOJVinculado(oj);
        }
      }

      // Etapa 6: Armazenar resultado no cache local
      this.verificacoesRealizadas.set(ojNormalizado, {
        resultado: resultado.jaVinculado,
        timestamp: Date.now()
      });

      if (resultado.jaVinculado) {
        this.estatisticas.ojsDetectadosJaVinculados++;
      }

    } catch (error) {
      this.logger.error(`❌ Erro na verificação dupla de ${oj}: ${error.message}`);
      resultado.jaVinculado = false;
      resultado.metodoDeteccao = 'erro';
      resultado.confiabilidade = 0;
    } finally {
      resultado.tempoVerificacao = Date.now() - inicioTempo;
      this.estatisticas.totalVerificacoes++;
      this.estatisticas.tempoTotalMs += resultado.tempoVerificacao;
    }

    return resultado;
  }

  /**
   * Analisa consenso entre diferentes métodos de verificação
   * @param {boolean} cacheResult - Resultado do cache
   * @param {Object} verificacaoDireta - Resultado da verificação direta
   * @returns {Object} Análise de consenso
   */
  _analisarConsenso(cacheResult, verificacaoDireta) {
    // Caso 1: Apenas cache disponível
    if (cacheResult && !verificacaoDireta) {
      return {
        jaVinculado: cacheResult,
        metodo: 'cache_inteligente',
        confiabilidade: 0.85,
        consenso: true
      };
    }

    // Caso 2: Apenas verificação direta disponível
    if (!cacheResult && verificacaoDireta) {
      return {
        jaVinculado: verificacaoDireta.jaVinculado,
        metodo: 'verificacao_direta',
        confiabilidade: 0.95,
        consenso: true
      };
    }

    // Caso 3: Ambos disponíveis - verificar consenso
    if (cacheResult !== undefined && verificacaoDireta) {
      const consenso = cacheResult === verificacaoDireta.jaVinculado;
      
      if (consenso) {
        return {
          jaVinculado: cacheResult,
          metodo: 'consenso_duplo',
          confiabilidade: 0.98,
          consenso: true
        };
      } else {
        // Em caso de conflito, priorizar verificação direta
        return {
          jaVinculado: verificacaoDireta.jaVinculado,
          metodo: 'verificacao_direta_conflito',
          confiabilidade: 0.9,
          consenso: false
        };
      }
    }

    // Caso 4: Nenhum método disponível
    return {
      jaVinculado: false,
      metodo: 'nenhum_disponivel',
      confiabilidade: 0,
      consenso: false
    };
  }

  /**
   * Normaliza um OJ para comparação
   * @param {string} oj - OJ a ser normalizado
   * @returns {string} OJ normalizado
   */
  _normalizarOJ(oj) {
    if (!oj) {
      return '';
    }
    
    // Validação de tipo para evitar erros
    let ojTexto;
    if (typeof oj === 'string') {
      ojTexto = oj;
    } else if (oj && typeof oj === 'object' && oj.nome) {
      ojTexto = oj.nome;
    } else {
      ojTexto = String(oj || '');
    }
    
    let normalizado = ojTexto
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' '); // Substitui múltiplos espaços por um só
    
    // Para CEJUSCs, preserva a estrutura exata para evitar falsos positivos
    if (normalizado.includes('cejusc')) {
      // Remove apenas espaços extras, mas preserva a estrutura
      normalizado = ojTexto.trim().replace(/\s+/g, ' ');
    }
    
    return normalizado;
  }

  /**
   * Executa verificação em lote com verificação dupla
   * @param {Object} page - Página do Playwright
   * @param {Array} ojs - Lista de OJs
   * @param {Object} smartOJCache - Cache inteligente
   * @param {Function} progressCallback - Callback de progresso
   * @returns {Object} Resultado da verificação em lote
   */
  async verificarLoteComDuplaVerificacao(page, ojs, smartOJCache, progressCallback = null) {
    const resultado = {
      ojsVerificados: [],
      ojsJaVinculados: [],
      ojsParaVincular: [],
      estatisticas: {
        total: ojs.length,
        jaVinculados: 0,
        paraVincular: 0,
        verificacoesDiretas: 0,
        inconsistenciasDetectadas: 0,
        tempoTotalMs: 0
      }
    };

    const inicioTempo = Date.now();

    for (let i = 0; i < ojs.length; i++) {
      const oj = ojs[i];
      
      if (progressCallback) {
        const progresso = Math.round(((i + 1) / ojs.length) * 100);
        progressCallback(`🔍 Verificação dupla: ${oj}`, progresso);
      }

      const verificacao = await this.verificarOJDupla(page, oj, smartOJCache);
      
      const itemResultado = {
        oj,
        jaVinculado: verificacao.jaVinculado,
        metodoDeteccao: verificacao.metodoDeteccao,
        confiabilidade: verificacao.confiabilidade,
        tempoVerificacao: verificacao.tempoVerificacao
      };

      resultado.ojsVerificados.push(itemResultado);

      if (verificacao.jaVinculado) {
        resultado.ojsJaVinculados.push(itemResultado);
        resultado.estatisticas.jaVinculados++;
      } else {
        resultado.ojsParaVincular.push(itemResultado);
        resultado.estatisticas.paraVincular++;
      }

      if (verificacao.metodoDeteccao.includes('direta')) {
        resultado.estatisticas.verificacoesDiretas++;
      }

      if (!verificacao.detalhes.consenso) {
        resultado.estatisticas.inconsistenciasDetectadas++;
      }

      // Pequena pausa entre verificações
      await page.waitForTimeout(50);
    }

    resultado.estatisticas.tempoTotalMs = Date.now() - inicioTempo;

    this.logger.info('✅ Verificação dupla em lote concluída:');
    this.logger.info(`   - Total: ${resultado.estatisticas.total}`);
    this.logger.info(`   - Já vinculados: ${resultado.estatisticas.jaVinculados}`);
    this.logger.info(`   - Para vincular: ${resultado.estatisticas.paraVincular}`);
    this.logger.info(`   - Verificações diretas: ${resultado.estatisticas.verificacoesDiretas}`);
    this.logger.info(`   - Inconsistências: ${resultado.estatisticas.inconsistenciasDetectadas}`);
    this.logger.info(`   - Tempo total: ${resultado.estatisticas.tempoTotalMs}ms`);

    return resultado;
  }

  /**
   * Gera relatório de estatísticas da verificação dupla
   * @returns {Object} Relatório de estatísticas
   */
  gerarRelatorioEstatisticas() {
    const tempoMedio = this.estatisticas.totalVerificacoes > 0 
      ? this.estatisticas.tempoTotalMs / this.estatisticas.totalVerificacoes 
      : 0;

    return {
      totalVerificacoes: this.estatisticas.totalVerificacoes,
      cacheHits: this.estatisticas.cacheHits,
      verificacoesDiretas: this.estatisticas.verificacoesDiretas,
      ojsDetectadosJaVinculados: this.estatisticas.ojsDetectadosJaVinculados,
      falsoPositivos: this.estatisticas.falsoPositivos,
      tempoMedioMs: Math.round(tempoMedio),
      eficienciaCache: this.estatisticas.totalVerificacoes > 0 
        ? (this.estatisticas.cacheHits / this.estatisticas.totalVerificacoes) * 100 
        : 0,
      taxaDeteccao: this.estatisticas.totalVerificacoes > 0 
        ? (this.estatisticas.ojsDetectadosJaVinculados / this.estatisticas.totalVerificacoes) * 100 
        : 0
    };
  }

  /**
   * Limpa cache local de verificações
   */
  limparCacheLocal() {
    this.verificacoesRealizadas.clear();
    this.logger.info('🧹 Cache local de verificações limpo');
  }

  /**
   * Reseta estatísticas
   */
  resetarEstatisticas() {
    this.estatisticas = {
      totalVerificacoes: 0,
      cacheHits: 0,
      verificacoesDiretas: 0,
      ojsDetectadosJaVinculados: 0,
      falsoPositivos: 0,
      tempoTotalMs: 0
    };
    this.logger.info('📊 Estatísticas resetadas');
  }
}

module.exports = { VerificacaoDuplaOJ };