/**
 * ⚡ OPTIMIZED TIMEOUT MANAGER
 * Gerenciador de timeouts otimizado para processamento paralelo
 * Reduz timeouts de 25s para valores ultra-eficientes
 */

class OptimizedTimeoutManager {
  constructor() {
    this.timeouts = {
      // Timeouts ultra-rápidos para operações críticas
      critical: {
        pageLoad: 3000,        // Reduzido de 25000ms
        elementWait: 1500,     // Reduzido de 10000ms
        formSubmit: 2000,      // Reduzido de 15000ms
        navigation: 2500,      // Reduzido de 20000ms
        verification: 1000,    // Reduzido de 8000ms
        Login: 20000          // Aumentado para melhor estabilidade
      },
            
      // Timeouts rápidos para operações normais
      normal: {
        pageLoad: 5000,        // Reduzido de 25000ms
        elementWait: 2500,     // Reduzido de 10000ms
        formSubmit: 3000,      // Reduzido de 15000ms
        navigation: 4000,      // Reduzido de 20000ms
        verification: 2000,    // Reduzido de 8000ms
        Login: 30000          // Aumentado para melhor estabilidade
      },
            
      // Timeouts conservadores para operações complexas
      conservative: {
        pageLoad: 8000,        // Reduzido de 25000ms
        elementWait: 4000,     // Reduzido de 10000ms
        formSubmit: 5000,      // Reduzido de 15000ms
        navigation: 6000,      // Reduzido de 20000ms
        verification: 3000,    // Reduzido de 8000ms
        Login: 45000          // Aumentado para melhor estabilidade
      }
    };
        
    this.currentMode = 'normal';
    this.stats = {
      timeoutsSaved: 0,
      totalTimeSaved: 0,
      operationsCompleted: 0,
      timeoutFailures: 0
    };
        
    this.adaptiveSettings = {
      enabled: true,
      successThreshold: 0.95,  // 95% de sucesso para reduzir timeouts
      failureThreshold: 0.85,  // 85% de sucesso para aumentar timeouts
      adjustmentFactor: 0.8    // Fator de ajuste (20% de redução/aumento)
    };
  }

  /**
     * 🚀 OBTER TIMEOUT OTIMIZADO
     */
  getTimeout(operation, mode = null) {
    const selectedMode = mode || this.currentMode;
    const timeout = this.timeouts[selectedMode][operation];
        
    if (!timeout) {
      console.warn(`⚠️ [TIMEOUT] Operação desconhecida: ${operation}`);
      return this.timeouts[selectedMode].pageLoad; // Fallback
    }
        
    // Calcular economia de tempo
    const originalTimeout = this.getOriginalTimeout(operation);
    const timeSaved = originalTimeout - timeout;
    this.stats.timeoutsSaved++;
    this.stats.totalTimeSaved += timeSaved;
        
    console.log(`⚡ [TIMEOUT] ${operation}: ${timeout}ms (economia: ${timeSaved}ms)`);
    return timeout;
  }

  /**
     * 📊 OBTER TIMEOUT ORIGINAL (PARA COMPARAÇÃO)
     */
  getOriginalTimeout(operation) {
    const originalTimeouts = {
      pageLoad: 25000,
      elementWait: 10000,
      formSubmit: 15000,
      navigation: 20000,
      verification: 8000,
      Login: 30000  // Timeout original para login
    };
    return originalTimeouts[operation] || 25000;
  }

  /**
     * 🎯 DEFINIR MODO DE TIMEOUT
     */
  setMode(mode) {
    if (!this.timeouts[mode]) {
      console.error(`❌ [TIMEOUT] Modo inválido: ${mode}`);
      return false;
    }
        
    const previousMode = this.currentMode;
    this.currentMode = mode;
        
    console.log(`🔄 [TIMEOUT] Modo alterado: ${previousMode} → ${mode}`);
    this.logModeComparison(previousMode, mode);
        
    return true;
  }

  /**
     * 📊 COMPARAR MODOS
     */
  logModeComparison(previousMode, newMode) {
    console.log('\n📊 [TIMEOUT] Comparação de modos:');
        
    Object.keys(this.timeouts[newMode]).forEach(operation => {
      const previousTimeout = this.timeouts[previousMode][operation];
      const newTimeout = this.timeouts[newMode][operation];
      const difference = previousTimeout - newTimeout;
      const percentChange = Math.round((difference / previousTimeout) * 100);
            
      console.log(`   • ${operation}: ${previousTimeout}ms → ${newTimeout}ms (${percentChange > 0 ? '-' : '+'}${Math.abs(percentChange)}%)`);
    });
  }

  /**
     * 🧠 TIMEOUT ADAPTATIVO
     */
  async executeWithAdaptiveTimeout(operation, asyncFunction, mode = null) {
    const startTime = Date.now();
    const timeout = this.getTimeout(operation, mode);

    // Criar promise de timeout cancelável
    const timeoutPromise = this.createTimeoutPromise(timeout, operation);

    try {
      // Executar com timeout
      const result = await Promise.race([
        asyncFunction(),
        timeoutPromise
      ]);

      // Cancelar timeout se a operação foi bem-sucedida
      if (timeoutPromise.cancel) {
        timeoutPromise.cancel();
      }

      const executionTime = Date.now() - startTime;
      this.recordSuccess(operation, executionTime, timeout);

      return result;

    } catch (error) {
      // Cancelar timeout em caso de erro também
      if (timeoutPromise.cancel) {
        timeoutPromise.cancel();
      }

      const executionTime = Date.now() - startTime;
      this.recordFailure(operation, executionTime, timeout, error);
      throw error;
    }
  }

  /**
     * ⏰ CRIAR PROMISE DE TIMEOUT CANCELÁVEL
     */
  createTimeoutPromise(timeout, operation) {
    let timeoutId;
    let cancelled = false;

    const promise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        if (!cancelled) {
          console.log(`⏰ [TIMEOUT] Timeout acionado para operação: ${operation} (${timeout}ms)`);
          reject(new Error(`Timeout de ${timeout}ms excedido para operação: ${operation}`));
        }
      }, timeout);
    });

    // Adicionar método para cancelar o timeout
    promise.cancel = () => {
      if (timeoutId && !cancelled) {
        console.log(`✅ [TIMEOUT] Timeout cancelado para operação: ${operation}`);
        clearTimeout(timeoutId);
        timeoutId = null;
        cancelled = true;
      }
    };

    return promise;
  }

  /**
     * ✅ REGISTRAR SUCESSO
     */
  recordSuccess(operation, executionTime, timeout) {
    this.stats.operationsCompleted++;
        
    console.log(`✅ [TIMEOUT] ${operation} concluído em ${executionTime}ms (limite: ${timeout}ms)`);
        
    // Ajuste adaptativo
    if (this.adaptiveSettings.enabled) {
      this.considerTimeoutAdjustment(operation, executionTime, timeout, true);
    }
  }

  /**
     * ❌ REGISTRAR FALHA
     */
  recordFailure(operation, executionTime, timeout, error) {
    this.stats.timeoutFailures++;
        
    console.error(`❌ [TIMEOUT] ${operation} falhou em ${executionTime}ms (limite: ${timeout}ms): ${error.message}`);
        
    // Ajuste adaptativo
    if (this.adaptiveSettings.enabled) {
      this.considerTimeoutAdjustment(operation, executionTime, timeout, false);
    }
  }

  /**
     * 📊 REGISTRAR PERFORMANCE (MÉTODO COMPATÍVEL)
     */
  recordPerformance(operation, duration, success) {
    if (success) {
      this.recordSuccess(operation, duration, this.getTimeout(operation));
    } else {
      this.recordFailure(operation, duration, this.getTimeout(operation), new Error('Operation failed'));
    }
  }

  /**
     * 🧠 CONSIDERAR AJUSTE DE TIMEOUT
     */
  considerTimeoutAdjustment(operation, executionTime, currentTimeout, success) {
    const successRate = this.calculateSuccessRate();
        
    if (success && executionTime < currentTimeout * 0.5) {
      // Se executou em menos de 50% do timeout, considerar redução
      if (successRate > this.adaptiveSettings.successThreshold) {
        this.adjustTimeout(operation, this.adaptiveSettings.adjustmentFactor);
      }
    } else if (!success) {
      // Se falhou, considerar aumento
      if (successRate < this.adaptiveSettings.failureThreshold) {
        this.adjustTimeout(operation, 1 / this.adaptiveSettings.adjustmentFactor);
      }
    }
  }

  /**
     * 📊 CALCULAR TAXA DE SUCESSO
     */
  calculateSuccessRate() {
    const totalOperations = this.stats.operationsCompleted + this.stats.timeoutFailures;
    if (totalOperations === 0) return 1;
        
    return this.stats.operationsCompleted / totalOperations;
  }

  /**
     * 🔧 AJUSTAR TIMEOUT
     */
  adjustTimeout(operation, factor) {
    const currentTimeout = this.timeouts[this.currentMode][operation];
    const newTimeout = Math.round(currentTimeout * factor);
        
    // Limites mínimos e máximos
    const minTimeout = 500;   // Mínimo 500ms
    const maxTimeout = 15000; // Máximo 15s (ainda muito menor que os 25s originais)
        
    const adjustedTimeout = Math.max(minTimeout, Math.min(maxTimeout, newTimeout));
        
    if (adjustedTimeout !== currentTimeout) {
      this.timeouts[this.currentMode][operation] = adjustedTimeout;
            
      const change = adjustedTimeout > currentTimeout ? 'aumentado' : 'reduzido';
      console.log(`🔧 [TIMEOUT] ${operation} ${change}: ${currentTimeout}ms → ${adjustedTimeout}ms`);
    }
  }

  /**
     * 🚀 PROCESSAMENTO PARALELO COM TIMEOUTS OTIMIZADOS
     */
  async executeParallel(operations, maxConcurrency = 3) {
    console.log(`🚀 [PARALLEL] Executando ${operations.length} operações (max ${maxConcurrency} paralelas)`);
        
    const results = [];
    const errors = [];
        
    // Dividir em lotes
    for (let i = 0; i < operations.length; i += maxConcurrency) {
      const batch = operations.slice(i, i + maxConcurrency);
            
      console.log(`📦 [PARALLEL] Lote ${Math.floor(i / maxConcurrency) + 1}: ${batch.length} operações`);
            
      // Executar lote em paralelo
      const batchPromises = batch.map(async (operation, index) => {
        try {
          const result = await this.executeWithAdaptiveTimeout(
            operation.type,
            operation.function,
            'critical' // Usar timeouts críticos para processamento paralelo
          );
                    
          return { index: i + index, result, success: true };
        } catch (error) {
          return { index: i + index, error, success: false };
        }
      });
            
      // Aguardar conclusão do lote
      const batchResults = await Promise.all(batchPromises);
            
      // Processar resultados
      batchResults.forEach(item => {
        if (item.success) {
          results[item.index] = item.result;
        } else {
          errors[item.index] = item.error;
        }
      });
    }
        
    const successCount = results.filter(r => r !== undefined).length;
    const errorCount = errors.filter(e => e !== undefined).length;
        
    console.log(`✅ [PARALLEL] Concluído: ${successCount} sucessos, ${errorCount} erros`);
        
    return { results, errors, successCount, errorCount };
  }

  /**
     * 📊 OBTER ESTATÍSTICAS
     */
  getStats() {
    const successRate = this.calculateSuccessRate();
    const avgTimeSaved = this.stats.timeoutsSaved > 0 ? 
      Math.round(this.stats.totalTimeSaved / this.stats.timeoutsSaved) : 0;
        
    return {
      ...this.stats,
      successRate: Math.round(successRate * 100),
      avgTimeSavedPerOperation: avgTimeSaved,
      currentMode: this.currentMode
    };
  }

  /**
     * 📈 RELATÓRIO DE PERFORMANCE
     */
  generatePerformanceReport() {
    const stats = this.getStats();
        
    console.log('\n📈 ========== RELATÓRIO DE PERFORMANCE - TIMEOUTS ==========');
    console.log(`🎯 Modo atual: ${stats.currentMode}`);
    console.log(`📊 Operações completadas: ${stats.operationsCompleted}`);
    console.log(`❌ Falhas por timeout: ${stats.timeoutFailures}`);
    console.log(`✅ Taxa de sucesso: ${stats.successRate}%`);
    console.log(`⚡ Tempo total economizado: ${Math.round(stats.totalTimeSaved / 1000)}s`);
    console.log(`📉 Economia média por operação: ${stats.avgTimeSavedPerOperation}ms`);
        
    // Comparação com timeouts originais
    const totalOriginalTime = this.stats.timeoutsSaved * 15000; // Média dos timeouts originais
    const totalOptimizedTime = this.stats.totalTimeSaved;
    const improvementPercentage = Math.round((totalOptimizedTime / totalOriginalTime) * 100);
        
    console.log('\n🚀 MELHORIA DE PERFORMANCE:');
    console.log(`   • Tempo original estimado: ${Math.round(totalOriginalTime / 1000)}s`);
    console.log(`   • Tempo economizado: ${Math.round(totalOptimizedTime / 1000)}s`);
    console.log(`   • Melhoria: ${improvementPercentage}%`);
        
    return stats;
  }

  /**
     * 🔄 RESETAR ESTATÍSTICAS
     */
  reset() {
    this.stats = {
      timeoutsSaved: 0,
      totalTimeSaved: 0,
      operationsCompleted: 0,
      timeoutFailures: 0
    };
    console.log('🔄 [TIMEOUT] Estatísticas resetadas');
  }

  /**
     * ⚙️ CONFIGURAR AJUSTE ADAPTATIVO
     */
  configureAdaptive(settings) {
    this.adaptiveSettings = { ...this.adaptiveSettings, ...settings };
    console.log('⚙️ [TIMEOUT] Configuração adaptativa atualizada:', this.adaptiveSettings);
  }
}

module.exports = OptimizedTimeoutManager;