/**
 * Sistema de Cache Inteligente para Seletores DOM
 * Otimiza a performance reduzindo re-buscas de elementos
 * CORRIGE: Gargalos de performance identificados no terminal
 */

class SmartDOMCache {
  constructor(maxSize = 100, ttl = 300000) { // TTL: 5 minutos
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
    this.hitCount = 0;
    this.missCount = 0;
    this.lastCleanup = Date.now();
  }

  /**
   * Gera chave única para o cache baseada no contexto
   */
  generateKey(selector, context = 'default', page = null) {
    const pageUrl = page ? page.url() : 'unknown';
    const contextHash = this.hashString(`${pageUrl}-${context}-${selector}`);
    return `${contextHash}`;
  }

  /**
   * Hash simples para gerar chaves
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Armazena seletor no cache com metadados
   */
  set(selector, context, data, page = null) {
    try {
      const key = this.generateKey(selector, context, page);
      const entry = {
        selector,
        context,
        data,
        timestamp: Date.now(),
        hitCount: 0,
        lastUsed: Date.now(),
        pageUrl: page ? page.url() : null
      };

      this.cache.set(key, entry);
      
      // Limpar cache se exceder tamanho máximo
      if (this.cache.size > this.maxSize) {
        this.cleanup();
      }

      console.log(`📋 Cache DOM: Armazenado "${selector}" (contexto: ${context})`);
      return true;
    } catch (error) {
      console.log(`⚠️ Erro ao armazenar no cache DOM: ${error.message}`);
      return false;
    }
  }

  /**
   * Recupera seletor do cache
   */
  get(selector, context = 'default', page = null) {
    try {
      const key = this.generateKey(selector, context, page);
      const entry = this.cache.get(key);

      if (!entry) {
        this.missCount++;
        return null;
      }

      // Verificar se expirou
      if (Date.now() - entry.timestamp > this.ttl) {
        this.cache.delete(key);
        this.missCount++;
        console.log(`⏰ Cache DOM: Entrada expirada para "${selector}"`);
        return null;
      }

      // Atualizar estatísticas
      entry.hitCount++;
      entry.lastUsed = Date.now();
      this.hitCount++;

      console.log(`🎯 Cache DOM: Hit para "${selector}" (${entry.hitCount} hits)`);
      return entry.data;
    } catch (error) {
      console.log(`⚠️ Erro ao recuperar do cache DOM: ${error.message}`);
      this.missCount++;
      return null;
    }
  }

  /**
   * Verifica se seletor existe no cache e ainda é válido
   */
  has(selector, context = 'default', page = null) {
    const key = this.generateKey(selector, context, page);
    const entry = this.cache.get(key);
    
    if (!entry) return false;
    
    // Verificar se expirou
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Remove entrada específica do cache
   */
  delete(selector, context = 'default', page = null) {
    const key = this.generateKey(selector, context, page);
    const deleted = this.cache.delete(key);
    
    if (deleted) {
      console.log(`🗑️ Cache DOM: Removido "${selector}" (contexto: ${context})`);
    }
    
    return deleted;
  }

  /**
   * Limpa entradas expiradas e menos usadas
   */
  cleanup() {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    
    // Remover entradas expiradas
    let expiredCount = 0;
    entries.forEach(([key, entry]) => {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
        expiredCount++;
      }
    });

    // Se ainda exceder o tamanho, remover menos usadas
    if (this.cache.size > this.maxSize) {
      const sortedEntries = Array.from(this.cache.entries())
        .sort((a, b) => {
          // Priorizar por: hitCount (desc) -> lastUsed (desc)
          if (a[1].hitCount !== b[1].hitCount) {
            return b[1].hitCount - a[1].hitCount;
          }
          return b[1].lastUsed - a[1].lastUsed;
        });

      // Manter apenas os mais usados
      const toKeep = sortedEntries.slice(0, Math.floor(this.maxSize * 0.8));
      this.cache.clear();
      
      toKeep.forEach(([key, entry]) => {
        this.cache.set(key, entry);
      });
    }

    this.lastCleanup = now;
    console.log(`🧹 Cache DOM: Limpeza concluída (${expiredCount} expiradas, ${this.cache.size} mantidas)`);
  }

  /**
   * Limpa todo o cache
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
    console.log(`🗑️ Cache DOM: Limpo completamente (${size} entradas removidas)`);
  }

  /**
   * Retorna estatísticas do cache
   */
  getStats() {
    const totalRequests = this.hitCount + this.missCount;
    const hitRate = totalRequests > 0 ? (this.hitCount / totalRequests * 100).toFixed(2) : 0;
    
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: `${hitRate}%`,
      totalRequests,
      lastCleanup: new Date(this.lastCleanup).toISOString()
    };
  }

  /**
   * Gera relatório detalhado do cache
   */
  generateReport() {
    const stats = this.getStats();
    const entries = Array.from(this.cache.values())
      .sort((a, b) => b.hitCount - a.hitCount)
      .slice(0, 10); // Top 10 mais usados

    return {
      stats,
      topSelectors: entries.map(entry => ({
        selector: entry.selector,
        context: entry.context,
        hitCount: entry.hitCount,
        age: Math.round((Date.now() - entry.timestamp) / 1000),
        pageUrl: entry.pageUrl
      }))
    };
  }

  /**
   * Otimiza seletores baseado no histórico de uso
   */
  optimizeSelectors(context = 'default') {
    const contextEntries = Array.from(this.cache.values())
      .filter(entry => entry.context === context)
      .sort((a, b) => b.hitCount - a.hitCount);

    const optimizedSelectors = contextEntries
      .slice(0, 5) // Top 5 mais usados
      .map(entry => entry.selector);

    console.log(`🚀 Seletores otimizados para contexto "${context}":`, optimizedSelectors);
    return optimizedSelectors;
  }

  /**
   * Pré-carrega seletores comuns para um contexto
   */
  async preloadCommonSelectors(page, context = 'default') {
    const commonSelectors = [
      'button[aria-label="Alterar pessoa"]',
      '.visivel-hover',
      'button.visivel-hover',
      '.fa-pencil-alt',
      'mat-dialog-container button',
      '[role="dialog"] button'
    ];

    console.log(`🔄 Pré-carregando ${commonSelectors.length} seletores comuns...`);
    
    for (const selector of commonSelectors) {
      try {
        const elements = await page.$$(selector);
        if (elements.length > 0 && elements.length < 50) { // Evitar seletores muito genéricos
          this.set(selector, context, {
            count: elements.length,
            found: true,
            preloaded: true
          }, page);
        }
      } catch (error) {
        console.log(`⚠️ Erro ao pré-carregar seletor "${selector}": ${error.message}`);
      }
    }
    
    console.log(`✅ Pré-carregamento concluído para contexto "${context}"`);
  }
}

module.exports = { SmartDOMCache };