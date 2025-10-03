/**
 * Sistema de Cache Inteligente para Otimização de Performance
 * Evita reprocessamento desnecessário e acelera operações repetitivas
 */

class IntelligentCacheManager {
  constructor() {
    this.ojCache = new Map(); // Cache de OJs processados
    this.servidorCache = new Map(); // Cache de servidores processados
    this.selectorCache = new Map(); // Cache de seletores encontrados
    this.navigationCache = new Map(); // Cache de navegação
    this.performanceCache = new Map(); // Cache de métricas de performance
    this.sessionCache = new Map(); // Cache da sessão atual
    
    // Configurações de TTL (Time To Live)
    this.ttl = {
      oj: 30 * 60 * 1000, // 30 minutos
      servidor: 60 * 60 * 1000, // 1 hora
      selector: 15 * 60 * 1000, // 15 minutos
      navigation: 10 * 60 * 1000, // 10 minutos
      performance: 5 * 60 * 1000, // 5 minutos
      session: 2 * 60 * 60 * 1000 // 2 horas
    };
    
    // Estatísticas de cache
    this.stats = {
      hits: 0,
      misses: 0,
      saves: 0,
      evictions: 0
    };
    
    // Limpeza automática a cada 5 minutos
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Cache de OJs processados
   */
  cacheOJ(ojName, data) {
    const key = this.normalizeKey(ojName);
    const entry = {
      data,
      timestamp: Date.now(),
      hits: 0
    };
    
    this.ojCache.set(key, entry);
    this.stats.saves++;
    
    console.log(`💾 [CACHE] OJ cached: ${ojName}`);
  }

  getCachedOJ(ojName) {
    const key = this.normalizeKey(ojName);
    const entry = this.ojCache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    
    if (this.isExpired(entry, this.ttl.oj)) {
      this.ojCache.delete(key);
      this.stats.evictions++;
      this.stats.misses++;
      return null;
    }
    
    entry.hits++;
    this.stats.hits++;
    console.log(`🎯 [CACHE] OJ hit: ${ojName} (${entry.hits} hits)`);
    return entry.data;
  }

  /**
   * Cache de servidores processados
   */
  cacheServidor(cpf, data) {
    const key = this.normalizeKey(cpf);
    const entry = {
      data,
      timestamp: Date.now(),
      hits: 0
    };
    
    this.servidorCache.set(key, entry);
    this.stats.saves++;
    
    console.log(`💾 [CACHE] Servidor cached: ${cpf}`);
  }

  getCachedServidor(cpf) {
    const key = this.normalizeKey(cpf);
    const entry = this.servidorCache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    
    if (this.isExpired(entry, this.ttl.servidor)) {
      this.servidorCache.delete(key);
      this.stats.evictions++;
      this.stats.misses++;
      return null;
    }
    
    entry.hits++;
    this.stats.hits++;
    console.log(`🎯 [CACHE] Servidor hit: ${cpf} (${entry.hits} hits)`);
    return entry.data;
  }

  /**
   * Cache de seletores DOM
   */
  cacheSelector(selectorKey, element) {
    const entry = {
      element,
      timestamp: Date.now(),
      hits: 0
    };
    
    this.selectorCache.set(selectorKey, entry);
    this.stats.saves++;
    
    console.log(`💾 [CACHE] Selector cached: ${selectorKey}`);
  }

  getCachedSelector(selectorKey) {
    const entry = this.selectorCache.get(selectorKey);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    
    if (this.isExpired(entry, this.ttl.selector)) {
      this.selectorCache.delete(selectorKey);
      this.stats.evictions++;
      this.stats.misses++;
      return null;
    }
    
    entry.hits++;
    this.stats.hits++;
    console.log(`🎯 [CACHE] Selector hit: ${selectorKey} (${entry.hits} hits)`);
    return entry.element;
  }

  /**
   * Cache de navegação
   */
  cacheNavigation(url, pageData) {
    const key = this.normalizeKey(url);
    const entry = {
      pageData,
      timestamp: Date.now(),
      hits: 0
    };
    
    this.navigationCache.set(key, entry);
    this.stats.saves++;
    
    console.log(`💾 [CACHE] Navigation cached: ${url}`);
  }

  getCachedNavigation(url) {
    const key = this.normalizeKey(url);
    const entry = this.navigationCache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    
    if (this.isExpired(entry, this.ttl.navigation)) {
      this.navigationCache.delete(key);
      this.stats.evictions++;
      this.stats.misses++;
      return null;
    }
    
    entry.hits++;
    this.stats.hits++;
    console.log(`🎯 [CACHE] Navigation hit: ${url} (${entry.hits} hits)`);
    return entry.pageData;
  }

  /**
   * Cache de performance
   */
  cachePerformance(operation, metrics) {
    const entry = {
      metrics,
      timestamp: Date.now(),
      hits: 0
    };
    
    this.performanceCache.set(operation, entry);
    this.stats.saves++;
    
    console.log(`💾 [CACHE] Performance cached: ${operation}`);
  }

  getCachedPerformance(operation) {
    const entry = this.performanceCache.get(operation);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    
    if (this.isExpired(entry, this.ttl.performance)) {
      this.performanceCache.delete(operation);
      this.stats.evictions++;
      this.stats.misses++;
      return null;
    }
    
    entry.hits++;
    this.stats.hits++;
    return entry.metrics;
  }

  /**
   * Cache de sessão
   */
  cacheSession(key, data) {
    const entry = {
      data,
      timestamp: Date.now(),
      hits: 0
    };
    
    this.sessionCache.set(key, entry);
    this.stats.saves++;
    
    console.log(`💾 [CACHE] Session cached: ${key}`);
  }

  getCachedSession(key) {
    const entry = this.sessionCache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    
    if (this.isExpired(entry, this.ttl.session)) {
      this.sessionCache.delete(key);
      this.stats.evictions++;
      this.stats.misses++;
      return null;
    }
    
    entry.hits++;
    this.stats.hits++;
    return entry.data;
  }

  /**
   * Utilitários
   */
  normalizeKey(key) {
    return key.toString().toLowerCase().trim();
  }

  isExpired(entry, ttl) {
    return (Date.now() - entry.timestamp) > ttl;
  }

  /**
   * Limpeza automática de cache expirado
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    // Limpar cache de OJs
    for (const [key, entry] of this.ojCache.entries()) {
      if (this.isExpired(entry, this.ttl.oj)) {
        this.ojCache.delete(key);
        cleaned++;
      }
    }
    
    // Limpar cache de servidores
    for (const [key, entry] of this.servidorCache.entries()) {
      if (this.isExpired(entry, this.ttl.servidor)) {
        this.servidorCache.delete(key);
        cleaned++;
      }
    }
    
    // Limpar cache de seletores
    for (const [key, entry] of this.selectorCache.entries()) {
      if (this.isExpired(entry, this.ttl.selector)) {
        this.selectorCache.delete(key);
        cleaned++;
      }
    }
    
    // Limpar cache de navegação
    for (const [key, entry] of this.navigationCache.entries()) {
      if (this.isExpired(entry, this.ttl.navigation)) {
        this.navigationCache.delete(key);
        cleaned++;
      }
    }
    
    // Limpar cache de performance
    for (const [key, entry] of this.performanceCache.entries()) {
      if (this.isExpired(entry, this.ttl.performance)) {
        this.performanceCache.delete(key);
        cleaned++;
      }
    }
    
    // Limpar cache de sessão
    for (const [key, entry] of this.sessionCache.entries()) {
      if (this.isExpired(entry, this.ttl.session)) {
        this.sessionCache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      this.stats.evictions += cleaned;
      console.log(`🧹 [CACHE] Cleanup: ${cleaned} entries removed`);
    }
  }

  /**
   * Estatísticas do cache
   */
  getStats() {
    const hitRate = this.stats.hits / (this.stats.hits + this.stats.misses) * 100;
    
    return {
      ...this.stats,
      hitRate: hitRate.toFixed(2) + '%',
      totalEntries: {
        oj: this.ojCache.size,
        servidor: this.servidorCache.size,
        selector: this.selectorCache.size,
        navigation: this.navigationCache.size,
        performance: this.performanceCache.size,
        session: this.sessionCache.size
      }
    };
  }

  /**
   * Limpar todo o cache
   */
  clearAll() {
    this.ojCache.clear();
    this.servidorCache.clear();
    this.selectorCache.clear();
    this.navigationCache.clear();
    this.performanceCache.clear();
    this.sessionCache.clear();
    
    console.log('🧹 [CACHE] All caches cleared');
  }

  /**
   * Destruir o cache manager
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clearAll();
    console.log('🧹 [CACHE] Cache manager destroyed');
  }
}

module.exports = IntelligentCacheManager;