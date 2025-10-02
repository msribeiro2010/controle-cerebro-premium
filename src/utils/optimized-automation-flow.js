/**
 * Fluxo otimizado de automação PJE
 * Implementa verificação inteligente de OJs já cadastrados para pular etapas desnecessárias
 */

const PJEPageReader = require('./pje-page-reader');

class OptimizedAutomationFlow {
  constructor(page, config = {}) {
    this.page = page;
    this.pageReader = new PJEPageReader(page);
    this.config = {
      cacheEnabled: true,
      maxCacheAge: 30, // minutos
      skipThreshold: 90, // % de OJs existentes para pular servidor
      batchSize: 5, // número de OJs para processar por vez
      ...config
    };
    
    this.stats = {
      totalServers: 0,
      skippedServers: 0,
      processedServers: 0,
      totalOJs: 0,
      skippedOJs: 0,
      processedOJs: 0,
      timeSaved: 0
    };
  }

  /**
   * Processa um servidor com verificação otimizada
   */
  async processServerOptimized(serverData) {
    console.log(`🚀 Processando servidor: ${serverData.nome} (${serverData.cpf})`);
    
    const startTime = Date.now();
    this.stats.totalServers++;
    
    try {
      // 1. Verificar cache primeiro
      const cachedData = this.pageReader.getCacheData(serverData.cpf, this.config.maxCacheAge);
      let comparisonResult;
      
      if (cachedData && this.config.cacheEnabled) {
        console.log('📋 Usando dados do cache...');
        comparisonResult = cachedData;
      } else {
        console.log('🔍 Analisando página do servidor...');
        
        // 2. Extrair OJs já cadastrados da página
        const existingData = await this.pageReader.extractExistingOJs();
        
        // 3. Comparar com OJs desejados
        comparisonResult = await this.pageReader.compareOJs(serverData.ojs, existingData.ojs);
        
        // 4. Salvar no cache
        if (this.config.cacheEnabled) {
          this.pageReader.setCacheData(serverData.cpf, comparisonResult);
        }
      }
      
      // 5. Gerar relatório
      const report = this.pageReader.generateComparisonReport(comparisonResult, serverData.cpf);
      
      // 6. Decidir estratégia baseada nos resultados
      const strategy = this.determineProcessingStrategy(comparisonResult);
      
      console.log(`📊 Análise concluída: ${strategy.type.toUpperCase()}`);
      console.log(`   • Total OJs: ${comparisonResult.total}`);
      console.log(`   • Já cadastrados: ${comparisonResult.existingCount}`);
      console.log(`   • Faltando: ${comparisonResult.missingCount}`);
      console.log(`   • Progresso: ${comparisonResult.completionPercentage}%`);
      
      // 7. Executar estratégia
      const result = await this.executeStrategy(strategy, serverData, comparisonResult);
      
      // 8. Atualizar estatísticas
      this.updateStats(result);
      
      const processingTime = Date.now() - startTime;
      console.log(`⏱️ Processamento concluído em ${processingTime}ms`);
      
      return {
        ...result,
        report,
        processingTime,
        strategy: strategy.type
      };
      
    } catch (error) {
      console.error(`❌ Erro ao processar servidor ${serverData.cpf}:`, error);
      return {
        status: 'error',
        message: error.message,
        serverData,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Determina a melhor estratégia de processamento baseada na análise
   */
  determineProcessingStrategy(comparisonResult) {
    const completionPercentage = comparisonResult.completionPercentage;
    const missingCount = comparisonResult.missingCount;
    
    if (completionPercentage >= this.config.skipThreshold) {
      return {
        type: 'skip',
        reason: `${completionPercentage}% já cadastrado (≥${this.config.skipThreshold}%)`,
        timeSaving: 'high'
      };
    }
    
    if (missingCount === 0) {
      return {
        type: 'skip',
        reason: 'Todos os OJs já estão cadastrados',
        timeSaving: 'maximum'
      };
    }
    
    if (missingCount <= 2) {
      return {
        type: 'quick',
        reason: `Apenas ${missingCount} OJs faltando`,
        timeSaving: 'medium'
      };
    }
    
    if (missingCount <= 5) {
      return {
        type: 'batch',
        reason: `${missingCount} OJs para processar em lote`,
        timeSaving: 'low'
      };
    }
    
    return {
      type: 'full',
      reason: `${missingCount} OJs para processamento completo`,
      timeSaving: 'none'
    };
  }

  /**
   * Executa a estratégia determinada
   */
  async executeStrategy(strategy, serverData, comparisonResult) {
    switch (strategy.type) {
    case 'skip':
      return await this.executeSkipStrategy(serverData, comparisonResult);
      
    case 'quick':
      return await this.executeQuickStrategy(serverData, comparisonResult);
      
    case 'batch':
      return await this.executeBatchStrategy(serverData, comparisonResult);
      
    case 'full':
      return await this.executeFullStrategy(serverData, comparisonResult);
      
    default:
      throw new Error(`Estratégia desconhecida: ${strategy.type}`);
    }
  }

  /**
   * Estratégia: Pular servidor completamente
   */
  async executeSkipStrategy(serverData, comparisonResult) {
    console.log('⏭️ Pulando servidor - já está completo ou quase completo');
    
    this.stats.skippedServers++;
    this.stats.skippedOJs += comparisonResult.total;
    this.stats.timeSaved += this.estimateTimeSaved(comparisonResult.total);
    
    return {
      status: 'skipped',
      message: 'Servidor pulado - OJs já cadastrados',
      serverData,
      comparisonResult
    };
  }

  /**
   * Estratégia: Processamento rápido (1-2 OJs)
   */
  async executeQuickStrategy(serverData, comparisonResult) {
    console.log('⚡ Execução rápida - poucos OJs faltando');
    
    const missingOJs = comparisonResult.missing;
    const results = [];
    
    for (const oj of missingOJs) {
      console.log(`🔄 Cadastrando OJ: ${oj}`);
      
      try {
        // Aqui seria chamada a função real de cadastro
        const cadastroResult = await this.cadastrarOJ(oj, serverData.perfil);
        results.push({
          oj,
          status: 'success',
          result: cadastroResult
        });
        
        this.stats.processedOJs++;
      } catch (error) {
        console.error(`❌ Erro ao cadastrar ${oj}:`, error.message);
        results.push({
          oj,
          status: 'error',
          error: error.message
        });
      }
    }
    
    this.stats.processedServers++;
    this.stats.skippedOJs += comparisonResult.existingCount;
    this.stats.timeSaved += this.estimateTimeSaved(comparisonResult.existingCount);
    
    return {
      status: 'processed_quick',
      message: `Processamento rápido concluído: ${results.length} OJs`,
      serverData,
      comparisonResult,
      results
    };
  }

  /**
   * Estratégia: Processamento em lote (3-5 OJs)
   */
  async executeBatchStrategy(serverData, comparisonResult) {
    console.log('📦 Processamento em lote - alguns OJs faltando');
    
    const missingOJs = comparisonResult.missing;
    const batches = this.createBatches(missingOJs, this.config.batchSize);
    const results = [];
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`📦 Processando lote ${i + 1}/${batches.length} (${batch.length} OJs)`);
      
      for (const oj of batch) {
        try {
          const cadastroResult = await this.cadastrarOJ(oj, serverData.perfil);
          results.push({
            oj,
            status: 'success',
            result: cadastroResult,
            batch: i + 1
          });
          
          this.stats.processedOJs++;
        } catch (error) {
          console.error(`❌ Erro ao cadastrar ${oj}:`, error.message);
          results.push({
            oj,
            status: 'error',
            error: error.message,
            batch: i + 1
          });
        }
      }
      
      // Pequena pausa entre lotes para evitar sobrecarga
      if (i < batches.length - 1) {
        await this.sleep(1000);
      }
    }
    
    this.stats.processedServers++;
    this.stats.skippedOJs += comparisonResult.existingCount;
    this.stats.timeSaved += this.estimateTimeSaved(comparisonResult.existingCount);
    
    return {
      status: 'processed_batch',
      message: `Processamento em lote concluído: ${results.length} OJs em ${batches.length} lotes`,
      serverData,
      comparisonResult,
      results,
      batches: batches.length
    };
  }

  /**
   * Estratégia: Processamento completo (muitos OJs)
   */
  async executeFullStrategy(serverData, comparisonResult) {
    console.log('🔄 Processamento completo - muitos OJs para cadastrar');
    
    // Para muitos OJs, usar o fluxo de automação tradicional
    // mas ainda aproveitando os OJs já existentes
    const missingOJs = comparisonResult.missing;
    
    console.log(`⚠️ Atenção: ${comparisonResult.existingCount} OJs já cadastrados serão pulados`);
    console.log(`🔄 Processando ${missingOJs.length} OJs restantes...`);
    
    // Aqui seria chamado o sistema de automação tradicional
    // mas apenas com os OJs que faltam
    const results = await this.processTraditionalFlow(serverData, missingOJs);
    
    this.stats.processedServers++;
    this.stats.processedOJs += missingOJs.length;
    this.stats.skippedOJs += comparisonResult.existingCount;
    this.stats.timeSaved += this.estimateTimeSaved(comparisonResult.existingCount);
    
    return {
      status: 'processed_full',
      message: `Processamento completo: ${missingOJs.length} OJs processados, ${comparisonResult.existingCount} pulados`,
      serverData,
      comparisonResult,
      results
    };
  }

  /**
   * Função simulada de cadastro de OJ (seria integrada com o sistema real)
   */
  async cadastrarOJ(ojName, perfil) {
    console.log(`   ➤ Cadastrando: ${ojName} - ${perfil}`);
    
    // Simular tempo de processamento
    await this.sleep(2000);
    
    // Simular resultado
    return {
      oj: ojName,
      perfil,
      timestamp: new Date().toISOString(),
      success: true
    };
  }

  /**
   * Processa fluxo tradicional (seria integrado com sistema existente)
   */
  async processTraditionalFlow(serverData, ojsToProcess) {
    console.log('🔄 Executando fluxo tradicional otimizado...');
    
    // Esta função seria integrada com o sistema de automação existente
    // mas receberia apenas os OJs que realmente precisam ser processados
    
    const results = [];
    for (const oj of ojsToProcess) {
      try {
        const result = await this.cadastrarOJ(oj, serverData.perfil);
        results.push({ oj, status: 'success', result });
      } catch (error) {
        results.push({ oj, status: 'error', error: error.message });
      }
    }
    
    return results;
  }

  /**
   * Cria lotes de OJs para processamento
   */
  createBatches(items, batchSize) {
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Estima tempo economizado
   */
  estimateTimeSaved(ojCount) {
    // Estima 30 segundos por OJ pulado
    return ojCount * 30000; // em millisegundos
  }

  /**
   * Atualiza estatísticas
   */
  updateStats(result) {
    // Estatísticas já são atualizadas nas estratégias específicas
  }

  /**
   * Gera relatório final de estatísticas
   */
  generateFinalReport() {
    const totalTime = this.stats.timeSaved;
    const minutes = Math.floor(totalTime / 60000);
    const seconds = Math.floor((totalTime % 60000) / 1000);
    
    return {
      summary: {
        totalServers: this.stats.totalServers,
        processedServers: this.stats.processedServers,
        skippedServers: this.stats.skippedServers,
        totalOJs: this.stats.totalOJs,
        processedOJs: this.stats.processedOJs,
        skippedOJs: this.stats.skippedOJs,
        timeSaved: `${minutes}m ${seconds}s`
      },
      efficiency: {
        serverSkipRate: `${Math.round((this.stats.skippedServers / this.stats.totalServers) * 100)}%`,
        ojSkipRate: `${Math.round((this.stats.skippedOJs / this.stats.totalOJs) * 100)}%`,
        timeEfficiency: `${Math.round((this.stats.timeSaved / (this.stats.totalOJs * 30000)) * 100)}%`
      }
    };
  }

  /**
   * Utilitário para pausa
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = OptimizedAutomationFlow;