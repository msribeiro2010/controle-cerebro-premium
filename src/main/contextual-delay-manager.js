/**
 * Gerenciador de Delays Contextuais
 * Otimiza tempos de espera baseado no contexto da operação e performance do sistema
 */

class ContextualDelayManager {
  constructor(timeoutManager) {
    this.timeoutManager = timeoutManager;
    this.performanceHistory = new Map();
    this.contextualDelays = this.initializeContextualDelays();
    this.adaptiveMultipliers = {
      ultraRapido: 0.3,
      rapido: 0.5,
      normal: 1.0,
      lento: 1.5,
      muitoLento: 2.0
    };
    this.lastOperationTime = Date.now();
    this.consecutiveErrors = 0;
    this.systemLoad = 'normal';
  }

  /**
   * Inicializa delays contextuais base para diferentes tipos de operação
   */
  initializeContextualDelays() {
    return {
      // Navegação e carregamento HIPER-OTIMIZADOS
      pageLoad: { base: 250, min: 50, max: 1250, adaptive: true }, // Reduzido 75%
      navigation: { base: 200, min: 25, max: 750, adaptive: true }, // Reduzido 75%
      modalOpen: { base: 75, min: 10, max: 250, adaptive: true }, // Reduzido 75%
      modalClose: { base: 50, min: 8, max: 200, adaptive: true }, // Reduzido 75%
      
      // Interações com elementos HIPER-OTIMIZADAS
      click: { base: 50, min: 5, max: 250, adaptive: true }, // Reduzido 50%
      doubleClick: { base: 75, min: 10, max: 300, adaptive: true }, // Reduzido 50%
      hover: { base: 25, min: 3, max: 100, adaptive: true }, // Reduzido 50%
      focus: { base: 15, min: 3, max: 75, adaptive: true }, // Reduzido 50%
      
      // Preenchimento de formulários HIPER-OTIMIZADO
      typing: { base: 25, min: 5, max: 100, adaptive: true }, // Reduzido 50%
      formFill: { base: 50, min: 10, max: 200, adaptive: true }, // Reduzido 50%
      dropdown: { base: 100, min: 25, max: 400, adaptive: true }, // Reduzido 50%
      select: { base: 75, min: 15, max: 300, adaptive: true }, // Reduzido 50%
      
      // Operações específicas do PJE
      searchPJE: { base: 2000, min: 500, max: 8000, adaptive: true },
      loginPJE: { base: 1500, min: 300, max: 6000, adaptive: true },
      ojSelection: { base: 100, min: 25, max: 500, adaptive: true },
      saveOperation: { base: 1000, min: 250, max: 4000, adaptive: true },
      
      // Verificações e validações HIPER-OTIMIZADAS
      elementWait: { base: 125, min: 25, max: 500, adaptive: true }, // Reduzido 75%
      validation: { base: 75, min: 12, max: 300, adaptive: true }, // Reduzido 75%
      errorCheck: { base: 50, min: 10, max: 200, adaptive: true }, // Reduzido 75%
      
      // Operações em lote HIPER-OTIMIZADAS
      betweenOJs: { base: 1, min: 1, max: 25, adaptive: true }, // Reduzido para 1ms
      betweenServers: { base: 25, min: 5, max: 125, adaptive: true }, // Reduzido 75%
      batchOperation: { base: 12, min: 4, max: 50, adaptive: true }, // Reduzido 75%
      hyperFastBetweenOJs: { base: 1, min: 1, max: 5, adaptive: true }, // Novo contexto ultra-rápido
      
      // Recuperação de erros
      errorRecovery: { base: 1000, min: 200, max: 5000, adaptive: true },
      retry: { base: 500, min: 100, max: 2000, adaptive: true },
      stabilization: { base: 800, min: 150, max: 3000, adaptive: true },
      
      // Network e sincronização
      networkWait: { base: 1500, min: 300, max: 6000, adaptive: true },
      syncOperation: { base: 600, min: 120, max: 2500, adaptive: true },
      apiCall: { base: 1000, min: 200, max: 4000, adaptive: true }
    };
  }

  /**
   * Obtém delay otimizado baseado no contexto
   */
  getContextualDelay(context, options = {}) {
    const {
      priority = 'normal',
      forceMinimal = false,
      errorContext = false,
      networkSlow = false,
      systemBusy = false
    } = options;

    // Verificar se contexto existe
    if (!this.contextualDelays[context]) {
      console.warn(`⚠️ Contexto desconhecido: ${context}, usando delay padrão`);
      return this.getDefaultDelay(priority);
    }

    const config = this.contextualDelays[context];
    let delay = config.base;

    // Aplicar otimizações baseadas no contexto
    if (forceMinimal) {
      delay = config.min;
    } else if (config.adaptive) {
      delay = this.calculateAdaptiveDelay(context, config, {
        priority,
        errorContext,
        networkSlow,
        systemBusy
      });
    }

    // Aplicar multiplicadores baseados na performance do sistema
    const performanceLevel = this.getSystemPerformanceLevel();
    const multiplier = this.adaptiveMultipliers[performanceLevel] || 1.0;
    delay = Math.round(delay * multiplier);

    // Garantir limites
    delay = Math.max(config.min, Math.min(config.max, delay));

    // Registrar para análise futura
    this.recordDelayUsage(context, delay, options);

    console.log(`⏱️ Delay contextual [${context}]: ${delay}ms (${performanceLevel})`);
    return delay;
  }

  /**
   * Calcula delay adaptativo baseado em histórico e condições atuais
   */
  calculateAdaptiveDelay(context, config, options) {
    let delay = config.base;
    const history = this.performanceHistory.get(context);

    // Ajustar baseado no histórico de performance
    if (history && history.samples.length > 0) {
      const avgResponseTime = history.totalTime / history.samples.length;
      const successRate = history.successes / history.samples.length;

      // Se taxa de sucesso é alta e tempo de resposta baixo, reduzir delay
      if (successRate > 0.9 && avgResponseTime < config.base * 0.5) {
        delay *= 0.7;
      }
      // Se taxa de sucesso é baixa, aumentar delay
      else if (successRate < 0.7) {
        delay *= 1.5;
      }
      // Se tempo de resposta é alto, aumentar delay
      else if (avgResponseTime > config.base * 1.5) {
        delay *= 1.3;
      }
    }

    // Ajustes baseados em condições atuais
    if (options.errorContext) {
      delay *= 1.5; // Aumentar delay após erros
    }

    if (options.networkSlow) {
      delay *= 1.8; // Aumentar para rede lenta
    }

    if (options.systemBusy) {
      delay *= 1.4; // Aumentar para sistema ocupado
    }

    // Ajuste baseado em erros consecutivos
    if (this.consecutiveErrors > 0) {
      const errorMultiplier = 1 + (this.consecutiveErrors * 0.2);
      delay *= Math.min(errorMultiplier, 2.0); // Máximo 2x
    }

    // Ajuste baseado na prioridade
    switch (options.priority) {
    case 'critical':
      delay *= 0.5;
      break;
    case 'high':
      delay *= 0.7;
      break;
    case 'low':
      delay *= 1.3;
      break;
    default: // normal
      break;
    }

    return Math.round(delay);
  }

  /**
   * Obtém nível de performance do sistema
   */
  getSystemPerformanceLevel() {
    // Usar TimeoutManager para obter nível de performance
    if (this.timeoutManager && this.timeoutManager.nivelPerformance) {
      return this.timeoutManager.nivelPerformance;
    }

    // Fallback baseado em métricas locais
    const now = Date.now();
    const timeSinceLastOp = now - this.lastOperationTime;

    if (timeSinceLastOp < 100 && this.consecutiveErrors === 0) {
      return 'ultraRapido';
    } else if (timeSinceLastOp < 300 && this.consecutiveErrors <= 1) {
      return 'rapido';
    } else if (this.consecutiveErrors > 3) {
      return 'muitoLento';
    } else if (this.consecutiveErrors > 1) {
      return 'lento';
    }

    return 'normal';
  }

  /**
   * Registra uso de delay para análise futura
   */
  recordDelayUsage(context, delay, options) {
    if (!this.performanceHistory.has(context)) {
      this.performanceHistory.set(context, {
        samples: [],
        totalTime: 0,
        successes: 0,
        failures: 0
      });
    }

    const history = this.performanceHistory.get(context);
    history.samples.push({
      delay,
      timestamp: Date.now(),
      options: { ...options }
    });

    // Manter apenas últimas 50 amostras para performance
    if (history.samples.length > 50) {
      history.samples.shift();
    }
  }

  /**
   * Registra resultado de operação para ajuste futuro
   */
  recordOperationResult(context, duration, success) {
    if (!this.performanceHistory.has(context)) {
      this.recordDelayUsage(context, 0, {});
    }

    const history = this.performanceHistory.get(context);
    history.totalTime += duration;

    if (success) {
      history.successes++;
      this.consecutiveErrors = 0;
    } else {
      history.failures++;
      this.consecutiveErrors++;
    }

    this.lastOperationTime = Date.now();

    // Atualizar nível de performance do sistema
    this.updateSystemLoad();
  }

  /**
   * Atualiza carga do sistema baseado em métricas recentes
   */
  updateSystemLoad() {
    const recentFailures = Array.from(this.performanceHistory.values())
      .reduce((total, history) => total + history.failures, 0);
    
    const recentSuccesses = Array.from(this.performanceHistory.values())
      .reduce((total, history) => total + history.successes, 0);

    const totalOperations = recentFailures + recentSuccesses;
    
    if (totalOperations > 0) {
      const failureRate = recentFailures / totalOperations;
      
      if (failureRate > 0.3) {
        this.systemLoad = 'high';
      } else if (failureRate > 0.1) {
        this.systemLoad = 'medium';
      } else {
        this.systemLoad = 'low';
      }
    }
  }

  /**
   * Obtém delay padrão baseado na prioridade
   */
  getDefaultDelay(priority) {
    const defaults = {
      critical: 50,
      high: 100,
      normal: 200,
      low: 500
    };

    return defaults[priority] || defaults.normal;
  }

  /**
   * Delay inteligente que se adapta ao contexto
   */
  async smartDelay(context, options = {}) {
    const delay = this.getContextualDelay(context, options);
    
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    return delay;
  }

  /**
   * Delay progressivo para operações em lote
   */
  async progressiveDelay(context, iteration, totalIterations, options = {}) {
    const baseDelay = this.getContextualDelay(context, options);
    
    // Reduzir delay progressivamente conforme avança
    const progressFactor = 1 - (iteration / totalIterations) * 0.5;
    const adjustedDelay = Math.round(baseDelay * Math.max(progressFactor, 0.3));
    
    console.log(`⏱️ Delay progressivo [${context}] ${iteration}/${totalIterations}: ${adjustedDelay}ms`);
    
    if (adjustedDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, adjustedDelay));
    }
    
    return adjustedDelay;
  }

  /**
   * Delay com backoff exponencial para retry
   */
  async exponentialBackoffDelay(context, attempt, maxAttempts = 3, options = {}) {
    const baseDelay = this.getContextualDelay(context, { ...options, errorContext: true });
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    const jitteredDelay = exponentialDelay + (Math.random() * 200); // Adicionar jitter
    
    const finalDelay = Math.min(jitteredDelay, 10000); // Máximo 10s
    
    console.log(`⏱️ Backoff exponencial [${context}] tentativa ${attempt}/${maxAttempts}: ${Math.round(finalDelay)}ms`);
    
    if (finalDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, finalDelay));
    }
    
    return finalDelay;
  }

  /**
   * Delay adaptativo baseado na velocidade da rede
   */
  async networkAdaptiveDelay(context, options = {}) {
    // Simular detecção de velocidade da rede
    const networkSpeed = await this.detectNetworkSpeed();
    
    const networkOptions = {
      ...options,
      networkSlow: networkSpeed === 'slow',
      priority: networkSpeed === 'fast' ? 'high' : 'normal'
    };
    
    return await this.smartDelay(context, networkOptions);
  }

  /**
   * Detecta velocidade da rede (simulado)
   */
  async detectNetworkSpeed() {
    // Em uma implementação real, isso faria um teste de velocidade
    // Por agora, usar métricas de performance recentes
    const avgResponseTime = this.getAverageResponseTime();
    
    if (avgResponseTime < 500) {
      return 'fast';
    } else if (avgResponseTime < 2000) {
      return 'medium';
    } else {
      return 'slow';
    }
  }

  /**
   * Obtém tempo médio de resposta recente
   */
  getAverageResponseTime() {
    let totalTime = 0;
    let totalSamples = 0;
    
    for (const history of this.performanceHistory.values()) {
      if (history.samples.length > 0) {
        totalTime += history.totalTime;
        totalSamples += history.samples.length;
      }
    }
    
    return totalSamples > 0 ? totalTime / totalSamples : 1000;
  }

  /**
   * Reseta estatísticas de performance
   */
  resetPerformanceHistory() {
    this.performanceHistory.clear();
    this.consecutiveErrors = 0;
    this.systemLoad = 'normal';
    console.log('📊 Histórico de performance resetado');
  }

  /**
   * Obtém estatísticas de performance
   */
  getPerformanceStats() {
    const stats = {
      contexts: this.performanceHistory.size,
      totalOperations: 0,
      totalSuccesses: 0,
      totalFailures: 0,
      averageResponseTime: 0,
      systemLoad: this.systemLoad,
      consecutiveErrors: this.consecutiveErrors
    };

    for (const history of this.performanceHistory.values()) {
      stats.totalOperations += history.samples.length;
      stats.totalSuccesses += history.successes;
      stats.totalFailures += history.failures;
    }

    stats.averageResponseTime = this.getAverageResponseTime();
    stats.successRate = stats.totalOperations > 0 ? 
      (stats.totalSuccesses / stats.totalOperations) * 100 : 0;

    return stats;
  }

  /**
   * Configura delays personalizados para contextos específicos
   */
  setCustomDelay(context, config) {
    this.contextualDelays[context] = {
      base: config.base || 100,
      min: config.min || 10,
      max: config.max || 1000,
      adaptive: config.adaptive !== false
    };
    
    console.log(`⚙️ Delay customizado configurado para ${context}:`, this.contextualDelays[context]);
  }

  /**
   * Obtém configuração atual de um contexto
   */
  getContextConfig(context) {
    return this.contextualDelays[context] || null;
  }

  /**
   * Lista todos os contextos disponíveis
   */
  getAvailableContexts() {
    return Object.keys(this.contextualDelays);
  }
}

module.exports = ContextualDelayManager;