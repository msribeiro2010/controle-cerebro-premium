const { Logger } = require('./Logger');

/**
 * Sistema inteligente para detectar quando todos os OJs de um servidor já estão cadastrados
 * e automaticamente pular para o próximo servidor
 */
class ServidorSkipDetector {
  constructor() {
    this.logger = new Logger('ServidorSkipDetector');
    this.servidoresAnalisados = new Map(); // Map<servidorId, { totalOJs, ojsVinculados, ultimaVerificacao }>
    this.limiteTolerancia = 0.85; // 95% dos OJs vinculados = servidor completo
    this.limiteMinimo = 3; // Mínimo de OJs para considerar análise válida
  }

  /**
   * Analisa se um servidor deve ser pulado baseado no histórico de OJs já vinculados
   * @param {string} servidorId - ID único do servidor
   * @param {Array} ojsNormalizados - Lista de OJs normalizados que seriam processados
   * @param {Object} smartOJCache - Instância do cache inteligente
   * @returns {Object} Resultado da análise
   */
  analisarServidor(servidorId, ojsNormalizados, smartOJCache) {
    console.log(`\n🔍 [SKIP-DETECTOR] Analisando servidor ${servidorId}...`);
    console.log(`📊 [SKIP-DETECTOR] Total de OJs para verificar: ${ojsNormalizados.length}`);
    
    // Validação de entrada
    if (!servidorId || typeof servidorId !== 'string') {
      console.log(`⚠️ [SKIP-DETECTOR] ID do servidor inválido: ${servidorId}`);
      return {
        deveSerPulado: false,
        motivo: 'ID do servidor inválido - servidor será processado',
        estatisticas: {
          totalOJs: ojsNormalizados ? ojsNormalizados.length : 0,
          ojsVinculados: 0,
          porcentagemVinculada: 0
        }
      };
    }
    
    if (!ojsNormalizados || !Array.isArray(ojsNormalizados) || ojsNormalizados.length === 0) {
      console.log('⚠️ [SKIP-DETECTOR] Lista de OJs inválida ou vazia');
      return {
        deveSerPulado: false,
        motivo: 'Nenhum OJ válido para analisar - servidor será processado',
        estatisticas: {
          totalOJs: 0,
          ojsVinculados: 0,
          porcentagemVinculada: 0
        }
      };
    }
    
    // Verificar se o smartOJCache é válido
    if (!smartOJCache || typeof smartOJCache !== 'object') {
      console.log('⚠️ [SKIP-DETECTOR] SmartOJCache inválido - servidor será processado');
      return {
        deveSerPulado: false,
        motivo: 'Cache não disponível - servidor será processado',
        estatisticas: {
          totalOJs: ojsNormalizados.length,
          ojsVinculados: 0,
          porcentagemVinculada: 0
        }
      };
    }
    
    // Verificar se o cache está válido
    if (!smartOJCache.cacheValido) {
      console.log('⚠️ [SKIP-DETECTOR] Cache não está válido - servidor será processado para atualizar dados');
      return {
        deveSerPulado: false,
        motivo: 'Cache inválido - necessário processar para atualizar',
        estatisticas: {
          totalOJs: ojsNormalizados.length,
          ojsVinculados: 0,
          porcentagemVinculada: 0
        }
      };
    }
    
    // Verificar quantos OJs já estão vinculados
    let ojsVinculados = 0;
    let ojsComErro = 0;
    const detalhesOJs = [];
    
    ojsNormalizados.forEach((oj, index) => {
      try {
        // Validar OJ antes de verificar
        if (!oj || typeof oj !== 'string' || oj.trim().length === 0) {
          console.log(`⚠️ [SKIP-DETECTOR] OJ ${index + 1}/${ojsNormalizados.length} inválido: ${oj}`);
          ojsComErro++;
          detalhesOJs.push({
            oj,
            vinculado: false,
            erro: 'OJ inválido'
          });
          return;
        }
        
        const jaVinculado = smartOJCache.isOJVinculado(oj);
        
        detalhesOJs.push({
          oj,
          vinculado: jaVinculado,
          erro: null
        });
        
        if (jaVinculado) {
          ojsVinculados++;
          const ojTexto = typeof oj === 'string' ? oj : String(oj);
          console.log(`✅ [SKIP-DETECTOR] OJ ${index + 1}/${ojsNormalizados.length} já vinculado: ${ojTexto.substring(0, 50)}...`);
        } else {
          const ojTexto = typeof oj === 'string' ? oj : String(oj);
          console.log(`❌ [SKIP-DETECTOR] OJ ${index + 1}/${ojsNormalizados.length} NÃO vinculado: ${ojTexto.substring(0, 50)}...`);
        }
      } catch (error) {
        console.error(`❌ [SKIP-DETECTOR] Erro verificando OJ ${index + 1}: ${error.message}`);
        ojsComErro++;
        detalhesOJs.push({
          oj,
          vinculado: false,
          erro: error.message
        });
      }
    });
    
    const ojsValidos = ojsNormalizados.length - ojsComErro;
    const porcentagemVinculada = ojsValidos > 0 ? (ojsVinculados / ojsValidos) * 100 : 0;
    const ojsParaVincular = ojsValidos - ojsVinculados;
    
    console.log(`\n📈 [SKIP-DETECTOR] Estatísticas do servidor ${servidorId}:`);
    console.log(`   - Total de OJs: ${ojsNormalizados.length}`);
    console.log(`   - OJs válidos: ${ojsValidos}`);
    console.log(`   - OJs com erro: ${ojsComErro}`);
    console.log(`   - OJs já vinculados: ${ojsVinculados}`);
    console.log(`   - OJs para vincular: ${ojsParaVincular}`);
    console.log(`   - Porcentagem vinculada: ${porcentagemVinculada.toFixed(1)}%`);
    
    if (ojsComErro > 0) {
      console.log(`   ⚠️ Atenção: ${ojsComErro} OJs com problemas foram ignorados na análise`);
    }
    
    // Determinar ação baseada na análise
    const decisao = this.determinarAcao({
      servidorId,
      totalOJs: ojsNormalizados.length,
      ojsValidos,
      ojsComErro,
      ojsVinculados,
      ojsParaVincular,
      porcentagemVinculada,
      detalhesOJs
    });
    
    console.log(`\n🎯 [SKIP-DETECTOR] Decisão para servidor ${servidorId}: ${decisao.deveSerPulado ? 'PULAR' : 'PROCESSAR'}`);
    console.log(`   - Motivo: ${decisao.motivo}`);
    
    return decisao;
  }

  /**
   * Determina a ação a ser tomada baseada nas estatísticas
   * @param {Object} dados - Dados da análise do servidor
   * @returns {Object} Decisão sobre a ação
   */
  determinarAcao(dados) {
    const { 
      servidorId, 
      totalOJs, 
      ojsValidos = totalOJs, 
      ojsComErro = 0, 
      ojsVinculados, 
      ojsParaVincular = ojsValidos - ojsVinculados, 
      porcentagemVinculada, 
      detalhesOJs 
    } = dados;
    
    const historico = this.servidoresAnalisados.get(servidorId);
    
    // Cenário 0: Muitos OJs com erro - processar para investigar
    if (ojsComErro > 0 && (ojsComErro / totalOJs) > 0.2) {
      return {
        deveSerPulado: false,
        motivo: `${ojsComErro} OJs com erro (${((ojsComErro / totalOJs) * 100).toFixed(1)}%) - servidor será processado para investigar`,
        estatisticas: {
          totalOJs,
          ojsValidos,
          ojsComErro,
          ojsVinculados,
          ojsParaVincular,
          porcentagemVinculada
        }
      };
    }
    
    // Cenário 1: Poucos OJs válidos para processar
    if (ojsValidos < this.limiteMinimo) {
      return {
        deveSerPulado: false,
        motivo: `Servidor tem apenas ${ojsValidos} OJs válidos (abaixo do limite mínimo de ${this.limiteMinimo}) - será processado`,
        estatisticas: {
          totalOJs,
          ojsValidos,
          ojsComErro,
          ojsVinculados,
          ojsParaVincular,
          porcentagemVinculada
        }
      };
    }
    
    // Cenário 2: Todos os OJs já estão vinculados
    if (ojsVinculados === totalOJs) {
      return {
        deveSerPulado: true,
        motivo: `Todos os ${totalOJs} OJs já estão vinculados (100%) - servidor será pulado`,
        estatisticas: {
          totalOJs,
          ojsValidos,
          ojsComErro,
          ojsVinculados,
          ojsParaVincular,
          porcentagemVinculada
        }
      };
    }

    // Cenário 3: Percentual muito alto de OJs vinculados
    if (porcentagemVinculada >= (this.limiteTolerancia * 100) && totalOJs >= this.limiteMinimo) {
      return {
        deveSerPulado: true,
        motivo: `${porcentagemVinculada.toFixed(1)}% dos OJs já vinculados (limite: ${(this.limiteTolerancia * 100)}%) - servidor será pulado`,
        estatisticas: {
          totalOJs,
          ojsValidos,
          ojsComErro,
          ojsVinculados,
          ojsParaVincular,
          porcentagemVinculada
        }
      };
    }

    // Cenário 4: Histórico indica servidor estável
    if (historico && this.analisarTendenciaHistorica(historico, {
      totalOJs,
      ojsJaVinculados: ojsVinculados,
      percentualVinculado: porcentagemVinculada / 100
    })) {
      return {
        deveSerPulado: true,
        motivo: 'Histórico indica servidor estável sem novos OJs - servidor será pulado',
        estatisticas: {
          totalOJs,
          ojsValidos,
          ojsComErro,
          ojsVinculados,
          ojsParaVincular,
          porcentagemVinculada
        }
      };
    }

    // Cenário padrão: processar
    return {
      deveSerPulado: false,
      motivo: `${ojsParaVincular} OJs novos encontrados (${porcentagemVinculada.toFixed(1)}% vinculados) - servidor será processado`,
      estatisticas: {
        totalOJs,
        ojsValidos,
        ojsComErro,
        ojsVinculados,
        ojsParaVincular,
        porcentagemVinculada
      }
    };
  }

  /**
   * Analisa tendência histórica do servidor
   * @param {Object} historico - Histórico do servidor
   * @param {Object} statsAtuais - Estatísticas atuais
   * @returns {boolean} True se indica estabilidade
   */
  analisarTendenciaHistorica(historico, statsAtuais) {
    // Se o histórico mostra que nas últimas 3 verificações não houve novos OJs
    const tempoDecorrido = Date.now() - historico.ultimaVerificacao;
    const umDiaEmMs = 24 * 60 * 60 * 1000;
    
    // Se foi verificado recentemente (menos de 1 dia) e não havia OJs novos
    if (tempoDecorrido < umDiaEmMs && historico.ojsParaVincular === 0) {
      return true;
    }

    // Se o número de OJs vinculados não mudou significativamente
    const diferencaPercentual = Math.abs(statsAtuais.percentualVinculado - historico.percentualVinculado);
    if (diferencaPercentual < 0.05 && statsAtuais.percentualVinculado > 0.8) { // Menos de 5% de diferença e mais de 80% vinculado
      return true;
    }

    return false;
  }

  /**
   * Atualiza o histórico de um servidor
   * @param {string} servidorId - ID do servidor
   * @param {Object} stats - Estatísticas atuais
   */
  atualizarHistoricoServidor(servidorId, stats) {
    this.servidoresAnalisados.set(servidorId, {
      totalOJs: stats.totalOJs,
      ojsVinculados: stats.ojsJaVinculados,
      ojsParaVincular: stats.ojsParaVincular,
      percentualVinculado: stats.percentualVinculado,
      ultimaVerificacao: Date.now()
    });
  }

  /**
   * Gera relatório de eficiência dos servidores
   * @returns {Object} Relatório completo
   */
  gerarRelatorioEficiencia() {
    const relatorio = {
      totalServidores: this.servidoresAnalisados.size,
      servidoresCompletos: 0,
      servidoresQuaseCompletos: 0,
      servidoresAtivos: 0,
      economiaEstimada: 0,
      detalhes: []
    };

    this.servidoresAnalisados.forEach((dados, servidorId) => {
      const detalhe = {
        servidorId,
        status: '',
        percentualCompleto: (dados.percentualVinculado * 100).toFixed(1),
        ojsVinculados: dados.ojsVinculados,
        ojsParaVincular: dados.ojsParaVincular,
        ultimaVerificacao: new Date(dados.ultimaVerificacao).toLocaleString()
      };

      if (dados.percentualVinculado >= 1.0) {
        detalhe.status = '✅ Completo';
        relatorio.servidoresCompletos++;
        relatorio.economiaEstimada += dados.totalOJs * 5; // 5s por OJ
      } else if (dados.percentualVinculado >= this.limiteTolerancia) {
        detalhe.status = '🟡 Quase Completo';
        relatorio.servidoresQuaseCompletos++;
        relatorio.economiaEstimada += dados.ojsVinculados * 5;
      } else {
        detalhe.status = '🔄 Ativo';
        relatorio.servidoresAtivos++;
      }

      relatorio.detalhes.push(detalhe);
    });

    return relatorio;
  }

  /**
   * Limpa o histórico de servidores (útil para reset)
   */
  limparHistorico() {
    this.servidoresAnalisados.clear();
    this.logger.info('🧹 Histórico de servidores limpo');
  }

  /**
   * Configura limites de tolerância
   * @param {number} limiteTolerancia - Percentual de 0 a 1
   * @param {number} limiteMinimo - Número mínimo de OJs
   */
  configurarLimites(limiteTolerancia = 0.95, limiteMinimo = 3) {
    this.limiteTolerancia = Math.max(0.5, Math.min(1.0, limiteTolerancia));
    this.limiteMinimo = Math.max(1, limiteMinimo);
    this.logger.info(`⚙️ Limites configurados: ${(this.limiteTolerancia * 100)}% tolerância, ${this.limiteMinimo} OJs mínimo`);
  }
}

module.exports = { ServidorSkipDetector };