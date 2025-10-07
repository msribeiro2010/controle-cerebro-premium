/**
 * Sistema de Retry Inteligente com Backoff Exponencial
 * Gerencia tentativas de operações com estratégias adaptativas
 */

class SmartRetryManager {
  constructor(timeoutManager) {
    this.timeoutManager = timeoutManager;
    
    // Configurações base de retry - ULTRA OTIMIZADAS
    this.retryConfigs = {
      // Operações críticas do PJE
      navigation: {
        maxRetries: 3,          // Reduzido ainda mais
        baseDelay: 400,         // Reduzido ainda mais
        maxDelay: 10000,        // Reduzido ainda mais
        backoffMultiplier: 1.5, // Reduzido ainda mais
        jitterFactor: 0.05,     // Reduzido ainda mais
        retryableErrors: ['TimeoutError', 'NetworkError', 'ElementNotFound'],
        smartRetry: true        // Ativa retry inteligente
      },
      
      // Cliques e interações
      interaction: {
        maxRetries: 2,          // Reduzido para mais velocidade
        baseDelay: 200,         // Reduzido ainda mais
        maxDelay: 3000,         // Reduzido ainda mais
        backoffMultiplier: 1.2, // Reduzido ainda mais
        jitterFactor: 0.1,      // Reduzido ainda mais
        retryableErrors: ['ElementNotVisible', 'ElementDetached', 'TimeoutError'],
        smartRetry: true        // Ativa retry inteligente
      },
      
      // Busca de elementos
      elementSearch: {
        maxRetries: 3,          // Reduzido de 4
        baseDelay: 200,         // Reduzido de 300
        maxDelay: 5000,         // Reduzido de 8000
        backoffMultiplier: 1.6, // Reduzido de 1.8
        jitterFactor: 0.12,     // Reduzido de 0.15
        retryableErrors: ['ElementNotFound', 'TimeoutError']
      },
      
      // Operações de rede
      network: {
        maxRetries: 5,          // Reduzido de 6
        baseDelay: 1200,        // Reduzido de 2000
        maxDelay: 40000,        // Reduzido de 60000
        backoffMultiplier: 2.2, // Reduzido de 2.5
        jitterFactor: 0.25,     // Reduzido de 0.3
        retryableErrors: ['NetworkError', 'TimeoutError', 'ConnectionReset']
      },
      
      // Operações PJE específicas
      pjeOperation: {
        maxRetries: 3,          // Reduzido de 4
        baseDelay: 800,         // Reduzido de 1500
        maxDelay: 12000,        // Reduzido de 20000
        backoffMultiplier: 1.8, // Reduzido de 2
        jitterFactor: 0.2,      // Reduzido de 0.25
        retryableErrors: ['PJEError', 'SessionExpired', 'TimeoutError']
      },
      
      // Salvamento de dados
      save: {
        maxRetries: 3,
        baseDelay: 500,         // Reduzido de 800
        maxDelay: 10000,        // Reduzido de 15000
        backoffMultiplier: 2.0, // Reduzido de 2.2
        jitterFactor: 0.08,     // Reduzido de 0.1
        retryableErrors: ['SaveError', 'ValidationError', 'TimeoutError']
      }
    };
    
    // Estatísticas de retry
    this.stats = {
      totalRetries: 0,
      successfulRetries: 0,
      failedRetries: 0,
      operationStats: {},
      errorPatterns: new Map()
    };
    
    // Histórico de performance
    this.performanceHistory = [];
    this.maxHistorySize = 1000;
  }
  
  /**
   * Executa uma operação com retry inteligente
   */
  async executeWithRetry(operation, context = 'default', options = {}) {
    const config = this.getRetryConfig(context);
    const startTime = Date.now();
    let lastError = null;
    
    // Mesclar opções customizadas
    const finalConfig = { ...config, ...options };
    
    for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
      try {
        // Primeira tentativa sem delay
        if (attempt > 0) {
          const delay = this.calculateBackoffDelay(attempt, finalConfig);
          await this.smartDelay(delay, context);
        }
        
        console.log(`🔄 Tentativa ${attempt + 1}/${finalConfig.maxRetries + 1} para operação: ${context}`);
        
        const result = await operation();
        
        // Sucesso - registrar estatísticas
        this.recordSuccess(context, attempt, Date.now() - startTime);
        
        if (attempt > 0) {
          console.log(`✅ Operação ${context} bem-sucedida após ${attempt} tentativas`);
        }
        
        return result;
        
      } catch (error) {
        lastError = error;
        this.recordAttempt(context, attempt, error);
        
        // Verificar se o erro é retryable
        if (!this.isRetryableError(error, finalConfig)) {
          console.log(`❌ Erro não retryable para ${context}: ${error.message}`);
          break;
        }
        
        // Última tentativa
        if (attempt === finalConfig.maxRetries) {
          console.log(`❌ Todas as tentativas falharam para ${context}`);
          break;
        }
        
        console.log(`⚠️ Tentativa ${attempt + 1} falhou para ${context}: ${error.message}`);
      }
    }
    
    // Registrar falha final
    this.recordFailure(context, lastError);
    throw lastError;
  }
  
  /**
   * Calcula o delay com backoff exponencial e jitter
   */
  calculateBackoffDelay(attempt, config) {
    const exponentialDelay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
    const cappedDelay = Math.min(exponentialDelay, config.maxDelay);
    
    // Adicionar jitter para evitar thundering herd
    const jitter = cappedDelay * config.jitterFactor * (Math.random() - 0.5);
    const finalDelay = Math.max(100, cappedDelay + jitter);
    
    return Math.round(finalDelay);
  }
  
  /**
   * Verifica se um erro é retryable
   */
  isRetryableError(error, config) {
    const errorName = error.constructor.name;
    const errorMessage = error.message.toLowerCase();
    
    // Verificar erros que NÃO devem ser retryable (página/contexto/navegador fechado)
    const nonRetryablePatterns = [
      'target page, context or browser has been closed',
      'page has been closed',
      'context has been closed',
      'browser has been closed',
      'execution context was destroyed',
      'session closed'
    ];
    
    if (nonRetryablePatterns.some(pattern => errorMessage.includes(pattern))) {
      return false;
    }
    
    // Verificar tipos de erro específicos
    if (config.retryableErrors.includes(errorName)) {
      return true;
    }
    
    // Verificar padrões de mensagem retryable
    const retryablePatterns = [
      'timeout',
      'network',
      'connection',
      'element not found',
      'element not visible',
      'detached',
      'navigation',
      'session expired'
    ];
    
    return retryablePatterns.some(pattern => errorMessage.includes(pattern));
  }
  
  /**
   * Obtém configuração de retry para um contexto
   */
  getRetryConfig(context) {
    // Mapear contextos para configurações
    const contextMap = {
      'navigation': 'navigation',
      'click': 'interaction',
      'fill': 'interaction',
      'select': 'interaction',
      'search': 'elementSearch',
      'wait': 'elementSearch',
      'network': 'network',
      'pje': 'pjeOperation',
      'save': 'save',
      'default': 'interaction'
    };
    
    const configKey = contextMap[context] || 'interaction';
    return this.retryConfigs[configKey];
  }
  
  /**
   * Delay inteligente com base no contexto
   */
  async smartDelay(ms, context) {
    // Ajustar delay baseado na performance do sistema
    const performanceMultiplier = this.getPerformanceMultiplier();
    const adjustedDelay = Math.round(ms * performanceMultiplier);
    
    console.log(`⏱️ Delay inteligente: ${adjustedDelay}ms (original: ${ms}ms, contexto: ${context})`);
    
    if (this.timeoutManager && typeof this.timeoutManager.setTimeout === 'function') {
      await this.timeoutManager.setTimeout(adjustedDelay);
    } else {
      await new Promise(resolve => setTimeout(resolve, adjustedDelay));
    }
  }
  
  /**
   * Obtém multiplicador de performance baseado no histórico
   */
  getPerformanceMultiplier() {
    if (this.performanceHistory.length < 5) {
      return 1.0; // Performance neutra
    }
    
    const recentPerformance = this.performanceHistory.slice(-10);
    const avgDuration = recentPerformance.reduce((sum, p) => sum + p.duration, 0) / recentPerformance.length;
    const avgRetries = recentPerformance.reduce((sum, p) => sum + p.retries, 0) / recentPerformance.length;
    
    // Sistema lento = mais delay
    if (avgDuration > 5000 || avgRetries > 2) {
      return 1.5;
    }
    
    // Sistema rápido = menos delay
    if (avgDuration < 1000 && avgRetries < 0.5) {
      return 0.7;
    }
    
    return 1.0;
  }
  
  /**
   * Registra uma tentativa
   */
  recordAttempt(context, attempt, error) {
    this.stats.totalRetries++;
    
    if (!this.stats.operationStats[context]) {
      this.stats.operationStats[context] = {
        attempts: 0,
        successes: 0,
        failures: 0,
        totalRetries: 0
      };
    }
    
    this.stats.operationStats[context].attempts++;
    this.stats.operationStats[context].totalRetries += attempt;
    
    // Registrar padrão de erro
    const errorKey = `${context}:${error.constructor.name}`;
    this.stats.errorPatterns.set(errorKey, (this.stats.errorPatterns.get(errorKey) || 0) + 1);
  }
  
  /**
   * Registra um sucesso
   */
  recordSuccess(context, retries, duration) {
    this.stats.successfulRetries += retries;
    
    if (!this.stats.operationStats[context]) {
      this.stats.operationStats[context] = {
        attempts: 0,
        successes: 0,
        failures: 0,
        totalRetries: 0
      };
    }
    
    this.stats.operationStats[context].successes++;
    
    // Adicionar ao histórico de performance
    this.performanceHistory.push({
      context,
      retries,
      duration,
      timestamp: Date.now()
    });
    
    // Limitar tamanho do histórico
    if (this.performanceHistory.length > this.maxHistorySize) {
      this.performanceHistory = this.performanceHistory.slice(-this.maxHistorySize / 2);
    }
  }
  
  /**
   * Registra uma falha
   */
  recordFailure(context, error) {
    this.stats.failedRetries++;
    
    if (!this.stats.operationStats[context]) {
      this.stats.operationStats[context] = {
        attempts: 0,
        successes: 0,
        failures: 0,
        totalRetries: 0
      };
    }
    
    this.stats.operationStats[context].failures++;
  }
  
  /**
   * Retry específico para operações de navegação
   */
  async retryNavigation(navigationFn, url, options = {}) {
    return this.executeWithRetry(async () => {
      console.log(`🧭 Tentando navegar para: ${url}`);
      return await navigationFn(url);
    }, 'navigation', options);
  }
  
  /**
   * Retry específico para cliques
   */
  async retryClick(clickFn, selector, options = {}) {
    return this.executeWithRetry(async () => {
      console.log(`👆 Tentando clicar em: ${selector}`);
      return await clickFn(selector);
    }, 'click', options);
  }
  
  /**
   * Retry específico para busca de elementos
   */
  async retryElementSearch(searchFn, selector, options = {}) {
    return this.executeWithRetry(async () => {
      console.log(`🔍 Buscando elemento: ${selector}`);
      return await searchFn(selector);
    }, 'search', options);
  }
  
  /**
   * Retry específico para operações PJE
   */
  async retryPJEOperation(operationFn, operationName, options = {}) {
    return this.executeWithRetry(async () => {
      console.log(`⚖️ Executando operação PJE: ${operationName}`);
      return await operationFn();
    }, 'pje', options);
  }
  
  /**
   * Obtém estatísticas de retry
   */
  getStats() {
    const successRate = this.stats.totalRetries > 0 
      ? (this.stats.successfulRetries / this.stats.totalRetries * 100).toFixed(2)
      : 0;
    
    return {
      ...this.stats,
      successRate: `${successRate}%`,
      avgRetriesPerOperation: this.stats.totalRetries > 0 
        ? (this.stats.totalRetries / Object.keys(this.stats.operationStats).length).toFixed(2)
        : 0
    };
  }
  
  /**
   * Limpa estatísticas
   */
  clearStats() {
    this.stats = {
      totalRetries: 0,
      successfulRetries: 0,
      failedRetries: 0,
      operationStats: {},
      errorPatterns: new Map()
    };
    this.performanceHistory = [];
  }
  
  /**
   * Obtém configuração otimizada baseada no histórico
   */
  getOptimizedConfig(context) {
    const baseConfig = this.getRetryConfig(context);
    const stats = this.stats.operationStats[context];
    
    if (!stats || stats.attempts < 10) {
      return baseConfig; // Dados insuficientes
    }
    
    const successRate = stats.successes / stats.attempts;
    const avgRetries = stats.totalRetries / stats.attempts;
    
    // Ajustar configuração baseada na performance
    const optimizedConfig = { ...baseConfig };
    
    if (successRate < 0.7) {
      // Taxa de sucesso baixa - aumentar tentativas e delays
      optimizedConfig.maxRetries = Math.min(baseConfig.maxRetries + 2, 8);
      optimizedConfig.baseDelay = Math.round(baseConfig.baseDelay * 1.5);
    } else if (successRate > 0.95 && avgRetries < 1) {
      // Alta taxa de sucesso - reduzir tentativas
      optimizedConfig.maxRetries = Math.max(baseConfig.maxRetries - 1, 2);
      optimizedConfig.baseDelay = Math.round(baseConfig.baseDelay * 0.8);
    }
    
    return optimizedConfig;
  }
}

module.exports = SmartRetryManager;
