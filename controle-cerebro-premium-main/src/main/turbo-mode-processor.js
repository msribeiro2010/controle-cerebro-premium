/**
 * MODO TURBO - Processamento em lote com máxima velocidade
 * Sistema HIPER-OTIMIZADO para processamento ultra-rápido
 * Criado para otimização máxima de performance
 */

class TurboModeProcessor {
  constructor(intelligentCache, delayManager) {
    this.intelligentCache = intelligentCache;
    this.delayManager = delayManager;
    this.turboConfig = {
      maxConcurrentOJs: 10, // Processamento simultâneo máximo
      ultraFastDelay: 0.5, // Delay ultra-rápido entre operações
      batchSize: 50, // Tamanho do lote para processamento
      skipValidations: true, // Pular validações não críticas
      aggressiveCaching: true, // Cache agressivo
      hyperOptimizedTimeouts: {
        navigation: 3000,
        interaction: 1000,
        validation: 500
      }
    };
    this.stats = {
      processed: 0,
      cached: 0,
      skipped: 0,
      errors: 0,
      startTime: null,
      endTime: null
    };
  }

  /**
   * Ativa o modo turbo com configurações ultra-otimizadas
   */
  async activateTurboMode() {
    console.log('🚀 MODO TURBO ATIVADO - Configurações HIPER-OTIMIZADAS');
    this.stats.startTime = Date.now();
    
    // Configurações agressivas para máxima velocidade
    await this.configureHyperOptimizedSettings();
    
    return {
      mode: 'TURBO_ACTIVATED',
      config: this.turboConfig,
      message: 'Sistema configurado para máxima velocidade'
    };
  }

  /**
   * Processa OJs em modo turbo com lotes paralelos
   */
  async processTurboBatch(orgaosJulgadores, processFunction) {
    const batches = this.createOptimizedBatches(orgaosJulgadores);
    const results = [];
    
    console.log(`🔥 Processando ${batches.length} lotes em MODO TURBO`);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`⚡ Lote ${i + 1}/${batches.length} - ${batch.length} OJs`);
      
      // Processamento paralelo ultra-rápido
      const batchResults = await this.processParallelBatch(batch, processFunction);
      results.push(...batchResults);
      
      // Delay mínimo entre lotes
      if (i < batches.length - 1) {
        await this.delayManager.contextualDelay('hyperFastBetweenOJs');
      }
      
      // Atualizar estatísticas
      this.updateTurboStats(batchResults);
    }
    
    return results;
  }

  /**
   * Cria lotes otimizados para processamento paralelo
   */
  createOptimizedBatches(orgaosJulgadores) {
    const batches = [];
    const batchSize = this.turboConfig.batchSize;
    
    // Filtrar OJs já em cache para pular
    const filteredOJs = this.filterCachedOJs(orgaosJulgadores);
    
    for (let i = 0; i < filteredOJs.length; i += batchSize) {
      batches.push(filteredOJs.slice(i, i + batchSize));
    }
    
    return batches;
  }

  /**
   * Filtra OJs já processados usando cache inteligente
   */
  filterCachedOJs(orgaosJulgadores) {
    if (!this.turboConfig.aggressiveCaching) {
      return orgaosJulgadores;
    }
    
    const filtered = [];
    
    for (const oj of orgaosJulgadores) {
      const cacheKey = this.generateOJCacheKey(oj);
      
      if (this.intelligentCache.get('oj', cacheKey)) {
        this.stats.cached++;
        console.log(`💾 Cache HIT: ${oj} - PULANDO`);
        continue;
      }
      
      filtered.push(oj);
    }
    
    console.log(`🎯 Filtrados: ${filtered.length}/${orgaosJulgadores.length} OJs para processar`);
    return filtered;
  }

  /**
   * Processa lote em paralelo com máxima concorrência
   */
  async processParallelBatch(batch, processFunction) {
    const promises = [];
    const semaphore = new Array(this.turboConfig.maxConcurrentOJs).fill(null);
    
    for (const oj of batch) {
      const promise = this.processOJWithTurbo(oj, processFunction);
      promises.push(promise);
    }
    
    // Aguardar todos com timeout agressivo
    const results = await Promise.allSettled(promises);
    
    return results.map((result, index) => ({
      oj: batch[index],
      success: result.status === 'fulfilled',
      result: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason : null
    }));
  }

  /**
   * Processa OJ individual com otimizações turbo
   */
  async processOJWithTurbo(oj, processFunction) {
    const startTime = Date.now();
    
    try {
      // Verificar cache primeiro
      const cacheKey = this.generateOJCacheKey(oj);
      const cached = this.intelligentCache.get('oj', cacheKey);
      
      if (cached && this.turboConfig.aggressiveCaching) {
        this.stats.cached++;
        return cached;
      }
      
      // Processar com timeouts agressivos
      const result = await this.executeWithTurboTimeout(
        () => processFunction(oj),
        this.turboConfig.hyperOptimizedTimeouts.navigation
      );
      
      // Cachear resultado
      if (result && this.turboConfig.aggressiveCaching) {
        this.intelligentCache.set('oj', cacheKey, result, 3600); // 1 hora TTL
      }
      
      this.stats.processed++;
      return result;
      
    } catch (error) {
      this.stats.errors++;
      console.error(`❌ Erro TURBO processando ${oj}:`, error.message);
      throw error;
    }
  }

  /**
   * Executa função com timeout ultra-agressivo
   */
  async executeWithTurboTimeout(fn, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`TURBO_TIMEOUT: ${timeoutMs}ms`));
      }, timeoutMs);
      
      Promise.resolve(fn())
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Configura settings hiper-otimizados
   */
  async configureHyperOptimizedSettings() {
    // Configurações agressivas de cache
    this.intelligentCache.configure({
      maxSize: 10000, // Cache grande
      defaultTTL: 7200, // 2 horas
      cleanupInterval: 300000 // 5 minutos
    });
    
    console.log('⚙️ Configurações TURBO aplicadas:');
    console.log(`   • Concorrência máxima: ${this.turboConfig.maxConcurrentOJs}`);
    console.log(`   • Delay ultra-rápido: ${this.turboConfig.ultraFastDelay}ms`);
    console.log(`   • Tamanho do lote: ${this.turboConfig.batchSize}`);
    console.log(`   • Cache agressivo: ${this.turboConfig.aggressiveCaching ? 'ATIVO' : 'INATIVO'}`);
  }

  /**
   * Gera chave de cache para OJ
   */
  generateOJCacheKey(oj) {
    // Validação de tipo para evitar erros
    let ojTexto;
    if (typeof oj === 'string') {
      ojTexto = oj;
    } else if (oj && typeof oj === 'object' && oj.nome) {
      ojTexto = oj.nome;
    } else {
      ojTexto = String(oj || '');
    }
    
    return `turbo_oj_${ojTexto.toLowerCase().replace(/\s+/g, '_')}`;
  }

  /**
   * Atualiza estatísticas do modo turbo
   */
  updateTurboStats(batchResults) {
    for (const result of batchResults) {
      if (result.success) {
        this.stats.processed++;
      } else {
        this.stats.errors++;
      }
    }
  }

  /**
   * Gera relatório de performance do modo turbo
   */
  generateTurboReport() {
    this.stats.endTime = Date.now();
    const duration = this.stats.endTime - this.stats.startTime;
    const throughput = this.stats.processed / (duration / 1000);
    
    return {
      mode: 'TURBO',
      duration: `${(duration / 1000).toFixed(2)}s`,
      processed: this.stats.processed,
      cached: this.stats.cached,
      skipped: this.stats.skipped,
      errors: this.stats.errors,
      throughput: `${throughput.toFixed(2)} OJs/s`,
      efficiency: `${((this.stats.processed / (this.stats.processed + this.stats.errors)) * 100).toFixed(1)}%`,
      cacheHitRate: `${((this.stats.cached / (this.stats.processed + this.stats.cached)) * 100).toFixed(1)}%`
    };
  }

  /**
   * Desativa modo turbo e retorna estatísticas
   */
  async deactivateTurboMode() {
    const report = this.generateTurboReport();
    
    console.log('🏁 MODO TURBO FINALIZADO');
    console.log('📊 Relatório de Performance:');
    console.log(`   • Duração: ${report.duration}`);
    console.log(`   • Processados: ${report.processed}`);
    console.log(`   • Cache hits: ${report.cached}`);
    console.log(`   • Erros: ${report.errors}`);
    console.log(`   • Throughput: ${report.throughput}`);
    console.log(`   • Eficiência: ${report.efficiency}`);
    console.log(`   • Taxa cache: ${report.cacheHitRate}`);
    
    // Reset stats
    this.stats = {
      processed: 0,
      cached: 0,
      skipped: 0,
      errors: 0,
      startTime: null,
      endTime: null
    };
    
    return report;
  }
}

module.exports = TurboModeProcessor;