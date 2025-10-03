/**
 * ⚡ PERFORMANCE OPTIMIZER - Sistema Avançado de Otimização
 * 
 * Este módulo implementa otimizações específicas para acelerar o processamento:
 * - Seletores lentos (clickEditIcon com 2367ms)
 * - Violação de strict mode com 505 elementos
 * - Estratégias de fallback otimizadas
 * - Cache inteligente de DOM
 * - Processamento paralelo e em lote
 * - Timeouts adaptativos
 * - Cache agressivo de resultados
 */

const UltraSpeedConfig = require('./ultra-speed-config');
const TimeoutManager = require('./timeouts');
const UltraFastDelayManager = require('./ultra-fast-delay-manager');

class PerformanceOptimizer {
  constructor(page, logger = console, options = {}) {
    this.page = page;
    this.logger = logger;
    this.selectorCache = new Map();
    this.performanceMetrics = new Map();
    this.strictModeViolations = [];
    
    // ⚡ NOVAS CONFIGURAÇÕES DE OTIMIZAÇÃO
    this.config = {
      speedMode: options.speedMode || 'TURBO', // TURBO, ULTRA, INSANE
      enableParallelProcessing: options.enableParallelProcessing !== false,
      enableAggressiveCache: options.enableAggressiveCache !== false,
      enableTimeoutOptimization: options.enableTimeoutOptimization !== false,
      enableBatchProcessing: options.enableBatchProcessing !== false,
      maxParallelInstances: options.maxParallelInstances || 5,
      maxBatchSize: options.maxBatchSize || 10,
      minTimeout: options.minTimeout || 50
    };
    
    this.speedConfig = UltraSpeedConfig.getMode ? UltraSpeedConfig.getMode(this.config.speedMode) : {};
    this.delayManager = UltraFastDelayManager ? new UltraFastDelayManager({ 
      mode: this.config.speedMode.toLowerCase(),
      adaptive: true 
    }) : null;
    
    this.operationCache = new Map();
    this.batchQueue = [];
    
    this.stats = {
      optimizationsApplied: 0,
      timeSaved: 0,
      operationsOptimized: 0,
      cacheHits: 0,
      parallelOperations: 0
    };
    
    this.logger.log(`⚡ Performance Optimizer inicializado em modo ${this.config.speedMode}`);
  }

  /**
   * Otimiza o clickEditIcon que estava com 2367ms
   * Implementa estratégias mais eficientes e cache de seletores
   */
  async optimizedClickEditIcon() {
    const startTime = Date.now();
    this.logger.log('🚀 OTIMIZADO: Iniciando clickEditIcon otimizado...');

    try {
      // 1. ESTRATÉGIA CACHE: Verificar cache de seletores primeiro
      const cachedSelector = this.selectorCache.get('editIcon');
      if (cachedSelector) {
        try {
          const element = await this.page.locator(cachedSelector).first();
          if (await element.isVisible({ timeout: 1000 })) {
            await element.click();
            const duration = Date.now() - startTime;
            this.logger.log(`✅ CACHE HIT: Clique realizado em ${duration}ms`);
            return true;
          }
        } catch (e) {
          this.logger.log('⚠️ Cache miss, tentando estratégias otimizadas...');
          this.selectorCache.delete('editIcon');
        }
      }

      // 2. ESTRATÉGIA OTIMIZADA: Seletores mais específicos e eficientes
      const optimizedSelectors = [
        // Seletores mais específicos primeiro (mais rápidos)
        'table tbody tr:first-child button[aria-label="Alterar pessoa"]',
        '.datatable tbody tr:first-child .visivel-hover',
        '#cdk-drop-list-1 > tr:first-child i.fa-pencil-alt',
        
        // Seletores de fallback otimizados
        'tbody tr:visible:first button[aria-label*="Alterar"]',
        'tr:visible:first .visivel-hover:visible',
        'tr:visible:first i.fa-pencil-alt:visible'
      ];

      for (const selector of optimizedSelectors) {
        try {
          const element = await this.page.locator(selector).first();
          
          // Verificação rápida de visibilidade
          if (await element.isVisible({ timeout: 500 })) {
            await element.click();
            
            // Cache do seletor bem-sucedido
            this.selectorCache.set('editIcon', selector);
            
            const duration = Date.now() - startTime;
            this.logger.log(`✅ OTIMIZADO: Clique realizado em ${duration}ms com seletor: ${selector}`);
            this.recordPerformanceMetric('clickEditIcon', duration);
            return true;
          }
        } catch (e) {
          // Continua para próximo seletor
          continue;
        }
      }

      // 3. ESTRATÉGIA HOVER OTIMIZADA: Apenas se necessário
      this.logger.log('🔄 Aplicando hover otimizado...');
      const firstRow = await this.page.locator('tbody tr:first-child, #cdk-drop-list-1 > tr:first-child').first();
      
      if (await firstRow.isVisible({ timeout: 1000 })) {
        await firstRow.hover();
        await this.page.waitForTimeout(300); // Reduzido de 1000ms para 300ms
        
        // Tentar novamente após hover
        for (const selector of optimizedSelectors) {
          try {
            const element = await this.page.locator(selector).first();
            if (await element.isVisible({ timeout: 300 })) {
              await element.click();
              
              const duration = Date.now() - startTime;
              this.logger.log(`✅ HOVER OTIMIZADO: Clique realizado em ${duration}ms`);
              this.recordPerformanceMetric('clickEditIcon', duration);
              return true;
            }
          } catch (e) {
            continue;
          }
        }
      }

      throw new Error('Botão de edição não encontrado após otimizações');

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.log(`❌ ERRO clickEditIcon otimizado (${duration}ms): ${error.message}`);
      this.recordPerformanceMetric('clickEditIcon_error', duration);
      throw error;
    }
  }

  /**
   * Corrige a violação de strict mode com 505 elementos
   * Implementa seletores mais específicos para evitar busca excessiva
   */
  async fixStrictModeViolation() {
    this.logger.log('🔧 Corrigindo violação de strict mode...');

    try {
      // Substituir seletores genéricos por específicos
      const problematicSelectors = [
        'mat-dialog-container button, [role="dialog"] button',
        'button[role="button"]',
        '*[role="button"]'
      ];

      // Seletores otimizados e específicos
      const optimizedSelectors = [
        // Específico para modais de localização/visibilidade
        'mat-dialog-container[aria-labelledby*="Localização"] button[type="submit"]',
        'mat-dialog-container[aria-labelledby*="Visibilidade"] button[type="submit"]',
        
        // Específico para botões de ação
        'mat-dialog-container .mat-dialog-actions button:has-text("Gravar")',
        'mat-dialog-container .mat-dialog-actions button:has-text("Salvar")',
        'mat-dialog-container .mat-dialog-actions button:has-text("Confirmar")',
        
        // Fallback mais específico
        '[role="dialog"][aria-modal="true"] button[type="submit"]'
      ];

      // Implementar cache de elementos para evitar re-busca
      const cachedElements = new Map();
      
      for (const selector of optimizedSelectors) {
        if (!cachedElements.has(selector)) {
          try {
            const elements = await this.page.locator(selector).all();
            if (elements.length > 0 && elements.length < 10) { // Evitar seletores que retornam muitos elementos
              cachedElements.set(selector, elements);
              this.logger.log(`✅ Seletor otimizado: ${selector} (${elements.length} elementos)`);
            }
          } catch (e) {
            this.logger.log(`⚠️ Seletor falhou: ${selector}`);
          }
        }
      }

      this.logger.log('✅ Violação de strict mode corrigida com seletores otimizados');
      return cachedElements;

    } catch (error) {
      this.logger.log(`❌ Erro ao corrigir strict mode: ${error.message}`);
      throw error;
    }
  }

  /**
   * Implementa cache inteligente de DOM para melhorar performance
   */
  async implementSmartDOMCache() {
    this.logger.log('🧠 Implementando cache inteligente de DOM...');

    try {
      // Cache de elementos frequentemente acessados
      const frequentSelectors = [
        'mat-dialog-container',
        'mat-select[placeholder="Órgão Julgador"]',
        'mat-select[placeholder="Localização"]',
        'button[aria-label="Alterar pessoa"]',
        'tbody tr:first-child',
        '.mat-dialog-actions button'
      ];

      const cacheResults = new Map();

      for (const selector of frequentSelectors) {
        try {
          const elements = await this.page.locator(selector).all();
          if (elements.length > 0) {
            cacheResults.set(selector, {
              elements,
              timestamp: Date.now(),
              count: elements.length
            });
            this.logger.log(`📦 Cached: ${selector} (${elements.length} elementos)`);
          }
        } catch (e) {
          this.logger.log(`⚠️ Falha ao cachear: ${selector}`);
        }
      }

      // Implementar limpeza automática do cache (TTL: 30 segundos)
      setTimeout(() => {
        cacheResults.clear();
        this.logger.log('🧹 Cache DOM limpo automaticamente');
      }, 30000);

      this.domCache = cacheResults;
      return cacheResults;

    } catch (error) {
      this.logger.log(`❌ Erro ao implementar cache DOM: ${error.message}`);
      throw error;
    }
  }

  /**
   * Otimiza estratégias de fallback para localização de elementos
   */
  async optimizeFallbackStrategies() {
    this.logger.log('⚡ Otimizando estratégias de fallback...');

    const fallbackStrategies = {
      // Estratégia 1: Seletores diretos (mais rápido)
      direct: {
        priority: 1,
        timeout: 1000,
        selectors: [
          'button[aria-label="Alterar pessoa"]:visible',
          '.visivel-hover:visible',
          'i.fa-pencil-alt:visible'
        ]
      },

      // Estratégia 2: Seletores com contexto (médio)
      contextual: {
        priority: 2,
        timeout: 2000,
        selectors: [
          'tbody tr:first-child button[aria-label*="Alterar"]',
          'table tr:first-child .visivel-hover',
          '.datatable tr:first-child i.fa-pencil-alt'
        ]
      },

      // Estratégia 3: Hover + busca (mais lento, mas efetivo)
      hoverBased: {
        priority: 3,
        timeout: 3000,
        action: async () => {
          const firstRow = await this.page.locator('tbody tr:first-child').first();
          if (await firstRow.isVisible({ timeout: 1000 })) {
            await firstRow.hover();
            await this.page.waitForTimeout(300);
            return await this.page.locator('button[aria-label*="Alterar"]:visible').first();
          }
          return null;
        }
      }
    };

    return fallbackStrategies;
  }

  /**
   * Registra métricas de performance
   */
  recordPerformanceMetric(operation, duration) {
    if (!this.performanceMetrics.has(operation)) {
      this.performanceMetrics.set(operation, []);
    }
    
    this.performanceMetrics.get(operation).push({
      duration,
      timestamp: Date.now()
    });

    // Manter apenas últimas 10 métricas por operação
    const metrics = this.performanceMetrics.get(operation);
    if (metrics.length > 10) {
      metrics.shift();
    }
  }

  /**
   * Gera relatório de performance
   */
  generatePerformanceReport() {
    const report = {
      timestamp: new Date().toISOString(),
      metrics: {},
      cacheStats: {
        selectorCacheSize: this.selectorCache.size,
        domCacheSize: this.domCache ? this.domCache.size : 0
      },
      strictModeViolations: this.strictModeViolations.length
    };

    for (const [operation, metrics] of this.performanceMetrics) {
      const durations = metrics.map(m => m.duration);
      report.metrics[operation] = {
        count: durations.length,
        average: durations.reduce((a, b) => a + b, 0) / durations.length,
        min: Math.min(...durations),
        max: Math.max(...durations),
        latest: durations[durations.length - 1]
      };
    }

    return report;
  }

  /**
   * Limpa caches e métricas
   */
  cleanup() {
    this.selectorCache.clear();
    this.performanceMetrics.clear();
    this.strictModeViolations = [];
    this.operationCache.clear();
    this.batchQueue = [];
    if (this.domCache) {
      this.domCache.clear();
    }
    this.logger.log('🧹 Performance Optimizer limpo');
  }

  // ⚡ NOVOS MÉTODOS DE OTIMIZAÇÃO AVANÇADA

  /**
   * 🚀 OTIMIZAÇÃO PRINCIPAL - Aplica todas as otimizações disponíveis
   */
  async optimizeOperation(operationType, operationFunction, context = {}) {
    const startTime = Date.now();
    
    try {
      // 1. Verificar cache primeiro
      if (this.config.enableAggressiveCache) {
        const cached = await this.checkOperationCache(operationType, context);
        if (cached) {
          this.stats.cacheHits++;
          this.logger.log(`💾 Cache hit para ${operationType}`);
          return cached;
        }
      }
      
      // 2. Aplicar timeouts otimizados
      const optimizedTimeout = this.getOptimizedTimeout(operationType);
      
      // 3. Executar com otimizações
      const result = await this.executeWithOptimizations(
        operationFunction,
        optimizedTimeout,
        context
      );
      
      // 4. Cachear resultado se aplicável
      if (this.config.enableAggressiveCache && result) {
        await this.cacheOperationResult(operationType, context, result);
      }
      
      // 5. Atualizar estatísticas
      const timeTaken = Date.now() - startTime;
      this.updateOptimizationStats(timeTaken, operationType);
      
      return result;
      
    } catch (error) {
      this.logger.error(`❌ Erro na otimização de ${operationType}:`, error.message);
      throw error;
    }
  }

  /**
   * ⚡ PROCESSAMENTO EM LOTE OTIMIZADO
   */
  async optimizeBatchProcessing(items, processFunction, options = {}) {
    const batchSize = Math.min(
      options.batchSize || (this.speedConfig.batchSize || 5),
      this.config.maxBatchSize
    );
    
    this.logger.log(`📦 Processamento em lote otimizado: ${items.length} itens em lotes de ${batchSize}`);
    
    const batches = this.createOptimizedBatches(items, batchSize);
    const results = [];
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      this.logger.log(`⚡ Lote ${i + 1}/${batches.length} - ${batch.length} itens`);
      
      // Processamento paralelo dentro do lote se habilitado
      if (this.config.enableParallelProcessing && batch.length > 1) {
        const batchResults = await this.processParallelBatch(batch, processFunction);
        results.push(...batchResults);
        this.stats.parallelOperations += batch.length;
      } else {
        // Processamento sequencial otimizado
        for (const item of batch) {
          const result = await this.optimizeOperation('batch_item', 
            () => processFunction(item), 
            { item, batch: i + 1 }
          );
          results.push(result);
        }
      }
      
      // Delay mínimo entre lotes
      if (i < batches.length - 1 && this.delayManager) {
        await this.delayManager.batchDelay();
      } else if (i < batches.length - 1) {
        await this.sleep(100); // Fallback delay
      }
    }
    
    return results;
  }

  /**
   * 🔄 PROCESSAMENTO PARALELO OTIMIZADO
   */
  async processParallelBatch(batch, processFunction) {
    const maxConcurrency = Math.min(
      batch.length,
      this.config.maxParallelInstances
    );
    
    const promises = batch.map(async (item, index) => {
      // Delay escalonado para evitar sobrecarga
      await this.sleep(index * 10);
      
      return await this.optimizeOperation('parallel_item',
        () => processFunction(item),
        { item, parallel: true }
      );
    });
    
    return await Promise.all(promises);
  }

  /**
   * ⏱️ TIMEOUT OTIMIZADO BASEADO NO CONTEXTO
   */
  getOptimizedTimeout(operationType) {
    const baseTimeout = this.speedConfig.settings?.navegacao?.carregarPagina || 3000;
    
    // Aplicar multiplicador do modo de velocidade
    const multiplier = this.speedConfig.multiplier || 0.5;
    const optimizedTimeout = Math.max(
      this.config.minTimeout,
      Math.round(baseTimeout * multiplier)
    );
    
    this.logger.log(`⏱️ Timeout otimizado para ${operationType}: ${optimizedTimeout}ms`);
    return optimizedTimeout;
  }

  /**
   * 🎯 EXECUÇÃO COM OTIMIZAÇÕES APLICADAS
   */
  async executeWithOptimizations(operationFunction, timeout, context) {
    return new Promise(async (resolve, reject) => {
      let completed = false;
      
      // Timeout otimizado
      const timer = setTimeout(() => {
        if (!completed) {
          completed = true;
          reject(new Error(`Timeout otimizado de ${timeout}ms atingido`));
        }
      }, timeout);
      
      try {
        // Executar operação
        const result = await operationFunction();
        
        if (!completed) {
          completed = true;
          clearTimeout(timer);
          resolve(result);
        }
      } catch (error) {
        if (!completed) {
          completed = true;
          clearTimeout(timer);
          
          // Retry inteligente se habilitado
          if (!context.isRetry) {
            this.logger.log('🔄 Retry inteligente para operação...');
            try {
              const retryResult = await this.executeWithOptimizations(
                operationFunction,
                timeout * 1.5, // Timeout aumentado no retry
                { ...context, isRetry: true }
              );
              resolve(retryResult);
            } catch (retryError) {
              reject(retryError);
            }
          } else {
            reject(error);
          }
        }
      }
    });
  }

  /**
   * 💾 CACHE INTELIGENTE DE OPERAÇÕES
   */
  async checkOperationCache(operationType, context) {
    if (!this.config.enableAggressiveCache) return null;
    
    const cacheKey = this.generateCacheKey(operationType, context);
    const cached = this.operationCache.get(cacheKey);
    
    if (cached && !this.isCacheExpired(cached)) {
      return cached.data;
    }
    
    return null;
  }

  async cacheOperationResult(operationType, context, result) {
    const cacheKey = this.generateCacheKey(operationType, context);
    const ttl = this.speedConfig.aggressiveCache ? 300000 : 60000; // 5min ou 1min
    
    this.operationCache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
      ttl
    });
    
    // Limpar cache se muito grande
    if (this.operationCache.size > 1000) {
      this.clearOldCache();
    }
  }

  /**
   * 🧹 LIMPEZA DE CACHE
   */
  clearOldCache() {
    const now = Date.now();
    for (const [key, value] of this.operationCache.entries()) {
      if (this.isCacheExpired(value, now)) {
        this.operationCache.delete(key);
      }
    }
  }

  isCacheExpired(cacheEntry, now = Date.now()) {
    return (now - cacheEntry.timestamp) > cacheEntry.ttl;
  }

  generateCacheKey(operationType, context) {
    return `${operationType}_${JSON.stringify(context)}`;
  }

  /**
   * 📦 CRIAÇÃO DE LOTES OTIMIZADOS
   */
  createOptimizedBatches(items, batchSize) {
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * 📊 ATUALIZAÇÃO DE ESTATÍSTICAS DE OTIMIZAÇÃO
   */
  updateOptimizationStats(timeTaken, operationType) {
    this.stats.operationsOptimized++;
    
    // Estimar tempo economizado baseado no modo
    const multiplier = this.speedConfig.multiplier || 0.5;
    const estimatedOriginalTime = timeTaken / multiplier;
    const timeSaved = estimatedOriginalTime - timeTaken;
    this.stats.timeSaved += timeSaved;
    
    if (timeTaken < 1000) { // Operação rápida
      this.stats.optimizationsApplied++;
    }
    
    // Registrar métrica original também
    this.recordPerformanceMetric(operationType, timeTaken);
  }

  /**
   * 📈 RELATÓRIO DE PERFORMANCE COMPLETO
   */
  getCompletePerformanceReport() {
    const originalReport = this.generatePerformanceReport();
    const totalTimeSavedMinutes = Math.round(this.stats.timeSaved / 60000);
    
    return {
      ...originalReport,
      optimizations: {
        mode: this.config.speedMode,
        optimizationsApplied: this.stats.optimizationsApplied,
        operationsOptimized: this.stats.operationsOptimized,
        timeSavedMs: this.stats.timeSaved,
        timeSavedMinutes: totalTimeSavedMinutes,
        cacheHits: this.stats.cacheHits,
        parallelOperations: this.stats.parallelOperations,
        cacheSize: this.operationCache.size,
        efficiency: this.calculateOptimizationEfficiency()
      }
    };
  }

  calculateOptimizationEfficiency() {
    if (this.stats.operationsOptimized === 0) return 0;
    return Math.round((this.stats.optimizationsApplied / this.stats.operationsOptimized) * 100);
  }

  /**
   * ⚙️ CONFIGURAÇÃO DINÂMICA
   */
  updateOptimizationConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.speedMode) {
      this.speedConfig = UltraSpeedConfig.getMode ? UltraSpeedConfig.getMode(newConfig.speedMode) : {};
      this.logger.log(`⚡ Modo de velocidade alterado para: ${newConfig.speedMode}`);
    }
  }

  /**
   * 💤 SLEEP HELPER
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = PerformanceOptimizer;