/**
 * Sistema de cache inteligente para elementos DOM frequentemente acessados
 * Reduz o tempo de busca e melhora a performance da automação
 */

const TimeoutManager = require('../utils/timeouts.js');

class DOMCacheManager {
  constructor(page, timeoutManager) {
    this.page = page;
    this.timeoutManager = timeoutManager;
    this.cache = new Map();
    this.selectorStats = new Map();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.maxCacheSize = 100;
    this.cacheTimeout = 30000; // 30 segundos
    this.validationInterval = 5000; // 5 segundos
    
    // Seletores críticos que devem ser priorizados no cache
    this.criticalSelectors = new Set([
      'button[onclick*="adicionarOrgaoJulgador"]',
      'select[name="orgaoJulgador"]',
      'select[name="papel"]',
      'select[name="visibilidade"]',
      'button[onclick*="salvar"]',
      'table.rich-table',
      '.modal',
      '.ui-dialog',
      'input[name="cpf"]',
      'button[onclick*="pesquisar"]'
    ]);
    
    // Iniciar limpeza automática do cache
    this.startCacheCleanup();
  }

  /**
   * Busca um elemento com cache inteligente
   */
  async findElement(selector, options = {}) {
    const cacheKey = this.generateCacheKey(selector, options);
    const cached = this.getCachedElement(cacheKey);
    
    if (cached && await this.validateCachedElement(cached.element)) {
      this.cacheHits++;
      this.updateSelectorStats(selector, true);
      return cached.element;
    }
    
    // Cache miss - buscar elemento
    this.cacheMisses++;
    const element = await this.searchElement(selector, options);
    
    if (element) {
      this.cacheElement(cacheKey, element, selector);
      this.updateSelectorStats(selector, false);
    }
    
    return element;
  }

  /**
   * Busca múltiplos elementos com cache
   */
  async findElements(selector, options = {}) {
    const cacheKey = this.generateCacheKey(selector + '_all', options);
    const cached = this.getCachedElement(cacheKey);
    
    if (cached && await this.validateCachedElements(cached.element)) {
      this.cacheHits++;
      return cached.element;
    }
    
    this.cacheMisses++;
    const elements = await this.searchElements(selector, options);
    
    if (elements && elements.length > 0) {
      this.cacheElement(cacheKey, elements, selector);
    }
    
    return elements;
  }

  /**
   * Busca elemento com estratégias otimizadas
   */
  async searchElement(selector, options = {}) {
    const timeout = options.timeout || TimeoutManager.obterTimeout('interacao', 'aguardarElemento');
    const strategies = this.getSearchStrategies(selector);
    
    for (const strategy of strategies) {
      try {
        const element = await this.executeSearchStrategy(strategy, selector, timeout);
        if (element) {
          return element;
        }
      } catch (error) {
        console.log(`⚠️ Estratégia ${strategy} falhou para ${selector}:`, error.message);
      }
    }
    
    return null;
  }

  /**
   * Busca múltiplos elementos
   */
  async searchElements(selector, options = {}) {
    const timeout = options.timeout || TimeoutManager.obterTimeout('interacao', 'aguardarElemento');
    
    try {
      await this.page.waitForSelector(selector, { timeout });
      return await this.page.$$(selector);
    } catch (error) {
      return [];
    }
  }

  /**
   * Estratégias de busca otimizadas
   */
  getSearchStrategies(selector) {
    const strategies = ['waitForSelector', 'querySelector', 'xpath'];
    
    // Priorizar estratégias baseadas no histórico de sucesso
    const stats = this.selectorStats.get(selector);
    if (stats && stats.successfulStrategy) {
      strategies.unshift(stats.successfulStrategy);
    }
    
    return [...new Set(strategies)];
  }

  /**
   * Executa estratégia de busca específica
   */
  async executeSearchStrategy(strategy, selector, timeout) {
    switch (strategy) {
    case 'waitForSelector':
      await this.page.waitForSelector(selector, { timeout });
      return await this.page.$(selector);
        
    case 'querySelector':
      return await this.page.$(selector);
        
    case 'xpath':
      if (selector.startsWith('//')) {
        const elements = await this.page.$x(selector);
        return elements[0] || null;
      }
      return null;
        
    default:
      return null;
    }
  }

  /**
   * Gera chave única para o cache
   */
  generateCacheKey(selector, options = {}) {
    const optionsStr = JSON.stringify(options);
    return `${selector}_${optionsStr}`;
  }

  /**
   * Obtém elemento do cache
   */
  getCachedElement(cacheKey) {
    const cached = this.cache.get(cacheKey);
    
    if (!cached) {
      return null;
    }
    
    // Verificar se o cache expirou
    if (Date.now() - cached.timestamp > this.cacheTimeout) {
      this.cache.delete(cacheKey);
      return null;
    }
    
    return cached;
  }

  /**
   * Armazena elemento no cache
   */
  cacheElement(cacheKey, element, selector) {
    // Limpar cache se estiver muito grande
    if (this.cache.size >= this.maxCacheSize) {
      this.cleanOldestEntries();
    }
    
    const priority = this.criticalSelectors.has(selector) ? 'high' : 'normal';
    
    this.cache.set(cacheKey, {
      element,
      timestamp: Date.now(),
      selector,
      priority,
      accessCount: 1
    });
  }

  /**
   * Valida se elemento em cache ainda é válido
   */
  async validateCachedElement(element) {
    try {
      if (!element) return false;
      
      // Verificar se elemento ainda existe no DOM
      const isConnected = await element.evaluate(el => el.isConnected);
      if (!isConnected) return false;
      
      // Verificar se elemento ainda é visível (para elementos críticos)
      const isVisible = await element.isVisible().catch(() => false);
      return isVisible;
      
    } catch (error) {
      return false;
    }
  }

  /**
   * Valida múltiplos elementos em cache
   */
  async validateCachedElements(elements) {
    if (!Array.isArray(elements) || elements.length === 0) {
      return false;
    }
    
    try {
      // Verificar se pelo menos 80% dos elementos ainda são válidos
      const validationPromises = elements.slice(0, 5).map(el => 
        this.validateCachedElement(el)
      );
      
      const results = await Promise.all(validationPromises);
      const validCount = results.filter(Boolean).length;
      
      return validCount / results.length >= 0.8;
    } catch (error) {
      return false;
    }
  }

  /**
   * Atualiza estatísticas do seletor
   */
  updateSelectorStats(selector, wasHit) {
    const stats = this.selectorStats.get(selector) || {
      hits: 0,
      misses: 0,
      lastUsed: Date.now(),
      successfulStrategy: null
    };
    
    if (wasHit) {
      stats.hits++;
    } else {
      stats.misses++;
    }
    
    stats.lastUsed = Date.now();
    this.selectorStats.set(selector, stats);
  }

  /**
   * Pré-carrega elementos críticos
   */
  async preloadCriticalElements() {
    const preloadPromises = Array.from(this.criticalSelectors).map(async selector => {
      try {
        await this.findElement(selector, { timeout: 1000 });
      } catch (error) {
        // Ignorar erros de pré-carregamento
      }
    });
    
    await Promise.allSettled(preloadPromises);
  }

  /**
   * Invalida cache para um seletor específico
   */
  invalidateSelector(selector) {
    const keysToDelete = [];
    
    for (const [key, cached] of this.cache.entries()) {
      if (cached.selector === selector) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Limpa entradas mais antigas do cache
   */
  cleanOldestEntries() {
    const entries = Array.from(this.cache.entries());
    
    // Ordenar por prioridade e timestamp
    entries.sort((a, b) => {
      const [, cachedA] = a;
      const [, cachedB] = b;
      
      // Prioridade alta fica no cache
      if (cachedA.priority === 'high' && cachedB.priority !== 'high') {
        return 1;
      }
      if (cachedB.priority === 'high' && cachedA.priority !== 'high') {
        return -1;
      }
      
      // Ordenar por timestamp (mais antigo primeiro)
      return cachedA.timestamp - cachedB.timestamp;
    });
    
    // Remover 20% das entradas mais antigas
    const toRemove = Math.floor(entries.length * 0.2);
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  /**
   * Inicia limpeza automática do cache
   */
  startCacheCleanup() {
    setInterval(() => {
      this.cleanExpiredEntries();
      this.optimizeCacheSize();
    }, this.validationInterval);
  }

  /**
   * Remove entradas expiradas
   */
  cleanExpiredEntries() {
    const now = Date.now();
    const keysToDelete = [];
    
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > this.cacheTimeout) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Otimiza tamanho do cache
   */
  optimizeCacheSize() {
    if (this.cache.size > this.maxCacheSize * 0.8) {
      this.cleanOldestEntries();
    }
  }

  /**
   * Obtém estatísticas do cache
   */
  getStats() {
    const hitRate = this.cacheHits / (this.cacheHits + this.cacheMisses) * 100;
    
    return {
      cacheSize: this.cache.size,
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: hitRate.toFixed(2) + '%',
      selectorStats: Object.fromEntries(this.selectorStats)
    };
  }

  /**
   * Limpa todo o cache
   */
  clearCache() {
    this.cache.clear();
    this.selectorStats.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }
}

module.exports = DOMCacheManager;