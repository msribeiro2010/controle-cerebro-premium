/**
 * Configurações de Otimização de Banco de Dados
 * 
 * Este arquivo centraliza todas as configurações relacionadas à otimização
 * de comunicação com banco de dados para melhorar performance.
 */

class DatabaseOptimizationConfig {
  constructor() {
    // Configurações principais de otimização
    this.OPTIMIZATION_ENABLED = true;
    
    // Configurações específicas por funcionalidade
    this.SKIP_AUTOMATION_VERIFICATION = true;  // Pular verificação antes da automação
    this.SKIP_REALTIME_VERIFICATION = true;    // Pular verificação em tempo real
    this.USE_LOCAL_CACHE_ONLY = false;         // Usar apenas cache local
    this.ENABLE_SMART_CACHE = true;            // Habilitar cache inteligente
    
    // Configurações de timeout e fallback
    this.DATABASE_TIMEOUT = 5000;              // Timeout para consultas (ms)
    this.ENABLE_FALLBACK_TO_LOCAL = true;      // Fallback para dados locais
    this.MAX_RETRY_ATTEMPTS = 2;               // Máximo de tentativas
    
    // Configurações de performance
    this.BATCH_SIZE = 50;                      // Tamanho do lote para processamento
    this.PARALLEL_REQUESTS = 3;                // Requisições paralelas máximas
    
    // Configurações de debug
    this.DEBUG_OPTIMIZATION = true;            // Debug das otimizações
    this.LOG_PERFORMANCE_METRICS = true;       // Log de métricas de performance
  }

  /**
   * Verifica se deve pular verificação de automação
   */
  shouldSkipAutomationVerification() {
    return this.OPTIMIZATION_ENABLED && this.SKIP_AUTOMATION_VERIFICATION;
  }

  /**
   * Verifica se deve pular verificação em tempo real
   */
  shouldSkipRealtimeVerification() {
    return this.OPTIMIZATION_ENABLED && this.SKIP_REALTIME_VERIFICATION;
  }

  /**
   * Verifica se deve usar apenas cache local
   */
  shouldUseLocalCacheOnly() {
    return this.OPTIMIZATION_ENABLED && this.USE_LOCAL_CACHE_ONLY;
  }

  /**
   * Verifica se cache inteligente está habilitado
   */
  isSmartCacheEnabled() {
    return this.OPTIMIZATION_ENABLED && this.ENABLE_SMART_CACHE;
  }

  /**
   * Obtém timeout para consultas de banco
   */
  getDatabaseTimeout() {
    return this.DATABASE_TIMEOUT;
  }

  /**
   * Verifica se fallback para dados locais está habilitado
   */
  isFallbackToLocalEnabled() {
    return this.OPTIMIZATION_ENABLED && this.ENABLE_FALLBACK_TO_LOCAL;
  }

  /**
   * Obtém configurações de performance
   */
  getPerformanceConfig() {
    return {
      batchSize: this.BATCH_SIZE,
      parallelRequests: this.PARALLEL_REQUESTS,
      maxRetryAttempts: this.MAX_RETRY_ATTEMPTS
    };
  }

  /**
   * Verifica se debug de otimização está habilitado
   */
  isDebugEnabled() {
    return this.DEBUG_OPTIMIZATION;
  }

  /**
   * Verifica se log de métricas está habilitado
   */
  isPerformanceLoggingEnabled() {
    return this.LOG_PERFORMANCE_METRICS;
  }

  /**
   * Obtém todas as configurações como objeto
   */
  getAllConfigs() {
    return {
      optimizationEnabled: this.OPTIMIZATION_ENABLED,
      skipAutomationVerification: this.SKIP_AUTOMATION_VERIFICATION,
      skipRealtimeVerification: this.SKIP_REALTIME_VERIFICATION,
      useLocalCacheOnly: this.USE_LOCAL_CACHE_ONLY,
      enableSmartCache: this.ENABLE_SMART_CACHE,
      databaseTimeout: this.DATABASE_TIMEOUT,
      enableFallbackToLocal: this.ENABLE_FALLBACK_TO_LOCAL,
      maxRetryAttempts: this.MAX_RETRY_ATTEMPTS,
      batchSize: this.BATCH_SIZE,
      parallelRequests: this.PARALLEL_REQUESTS,
      debugOptimization: this.DEBUG_OPTIMIZATION,
      logPerformanceMetrics: this.LOG_PERFORMANCE_METRICS
    };
  }

  /**
   * Atualiza configurações dinamicamente
   */
  updateConfig(newConfig) {
    Object.keys(newConfig).forEach(key => {
      if (this.hasOwnProperty(key.toUpperCase())) {
        this[key.toUpperCase()] = newConfig[key];
      }
    });
  }

  /**
   * Reseta configurações para padrão
   */
  resetToDefaults() {
    this.OPTIMIZATION_ENABLED = true;
    this.SKIP_AUTOMATION_VERIFICATION = true;
    this.SKIP_REALTIME_VERIFICATION = true;
    this.USE_LOCAL_CACHE_ONLY = false;
    this.ENABLE_SMART_CACHE = true;
    this.DATABASE_TIMEOUT = 5000;
    this.ENABLE_FALLBACK_TO_LOCAL = true;
    this.MAX_RETRY_ATTEMPTS = 2;
    this.BATCH_SIZE = 50;
    this.PARALLEL_REQUESTS = 3;
    this.DEBUG_OPTIMIZATION = true;
    this.LOG_PERFORMANCE_METRICS = true;
  }

  /**
   * Obtém estatísticas de otimização
   */
  getOptimizationStats() {
    return {
      totalOptimizationsEnabled: Object.values(this.getAllConfigs()).filter(v => v === true).length,
      performanceMode: this.SKIP_AUTOMATION_VERIFICATION && this.SKIP_REALTIME_VERIFICATION ? 'ULTRA' : 'NORMAL',
      cacheStrategy: this.USE_LOCAL_CACHE_ONLY ? 'LOCAL_ONLY' : this.ENABLE_SMART_CACHE ? 'SMART' : 'DISABLED'
    };
  }
}

// Instância singleton
const dbOptimizationConfig = new DatabaseOptimizationConfig();

module.exports = {
  DatabaseOptimizationConfig,
  dbOptimizationConfig
};