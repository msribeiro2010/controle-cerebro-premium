// Sistema de cache inteligente para consultas de banco de dados
// Otimiza performance e reduz carga no banco

class DatabaseCache {
  constructor() {
    this.cache = new Map();
    this.cacheTimestamps = new Map();
    this.cacheExpiration = 5 * 60 * 1000; // 5 minutos
    this.maxCacheSize = 1000;
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalQueries: 0
    };
  }

  /**
   * Gera chave de cache baseada nos parâmetros
   * @param {string} operation - Operação (verificarOJs, verificarServidor, etc.)
   * @param {*} params - Parâmetros da consulta
   * @returns {string} Chave de cache
   */
  generateCacheKey(operation, params) {
    const key = `${operation}_${JSON.stringify(params)}`;
    return Buffer.from(key).toString('base64');
  }

  /**
   * Decodifica uma chave de cache em base64 para string legível
   */
  decodeCacheKey(key) {
    try {
      return Buffer.from(key, 'base64').toString('utf8');
    } catch (e) {
      return '';
    }
  }

  /**
   * Verifica se um item está no cache e não expirou
   * @param {string} key - Chave do cache
   * @returns {boolean} True se válido
   */
  isValid(key) {
    if (!this.cache.has(key)) {
      return false;
    }

    const timestamp = this.cacheTimestamps.get(key);
    const now = Date.now();
    
    if (now - timestamp > this.cacheExpiration) {
      this.cache.delete(key);
      this.cacheTimestamps.delete(key);
      this.stats.evictions++;
      return false;
    }

    return true;
  }

  /**
   * Obtém item do cache
   * @param {string} key - Chave do cache
   * @returns {*} Item do cache ou null
   */
  get(key) {
    this.stats.totalQueries++;
    
    if (this.isValid(key)) {
      this.stats.hits++;
      return this.cache.get(key);
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Armazena item no cache
   * @param {string} key - Chave do cache
   * @param {*} value - Valor a ser armazenado
   */
  set(key, value) {
    // Limpar cache se estiver muito grande
    if (this.cache.size >= this.maxCacheSize) {
      this.evictOldest();
    }

    this.cache.set(key, value);
    this.cacheTimestamps.set(key, Date.now());
  }

  /**
   * Remove o item mais antigo do cache
   */
  evictOldest() {
    let oldestKey = null;
    let oldestTime = Infinity;

    for (const [key, timestamp] of this.cacheTimestamps) {
      if (timestamp < oldestTime) {
        oldestTime = timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.cacheTimestamps.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  /**
   * Limpa cache específico por padrão
   * @param {string} pattern - Padrão para limpeza
   */
  clearPattern(pattern) {
    const keysToDelete = [];
    
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => {
      this.cache.delete(key);
      this.cacheTimestamps.delete(key);
    });
  }

  /**
   * Limpa todo o cache
   */
  clear() {
    this.cache.clear();
    this.cacheTimestamps.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalQueries: 0
    };
  }

  /**
   * Obtém estatísticas do cache
   * @returns {Object} Estatísticas
   */
  getStats() {
    const hitRate = this.stats.totalQueries > 0 
      ? (this.stats.hits / this.stats.totalQueries * 100).toFixed(2)
      : 0;

    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      cacheSize: this.cache.size,
      maxCacheSize: this.maxCacheSize
    };
  }

  /**
   * Cache específico para verificação de OJs
   * @param {number} idUsuario - ID do usuário
   * @param {Array} ojs - Lista de OJs
   * @returns {*} Resultado do cache ou null
   */
  getOJsVerification(idUsuario, ojs) {
    const key = this.generateCacheKey('verificarOJs', { idUsuario, ojs });
    return this.get(key);
  }

  /**
   * Armazena resultado de verificação de OJs
   * @param {number} idUsuario - ID do usuário
   * @param {Array} ojs - Lista de OJs
   * @param {*} result - Resultado da verificação
   */
  setOJsVerification(idUsuario, ojs, result) {
    const key = this.generateCacheKey('verificarOJs', { idUsuario, ojs });
    this.set(key, result);
  }

  /**
   * Cache específico para verificação de servidor
   * @param {number} idUsuario - ID do usuário
   * @returns {*} Resultado do cache ou null
   */
  getServidorVerification(idUsuario) {
    const key = this.generateCacheKey('verificarServidor', { idUsuario });
    return this.get(key);
  }

  /**
   * Armazena resultado de verificação de servidor
   * @param {number} idUsuario - ID do usuário
   * @param {*} result - Resultado da verificação
   */
  setServidorVerification(idUsuario, result) {
    const key = this.generateCacheKey('verificarServidor', { idUsuario });
    this.set(key, result);
  }

  /**
   * Invalida cache de um usuário específico
   * @param {number} idUsuario - ID do usuário
   */
  invalidateUserCache(idUsuario) {
    if (!idUsuario && idUsuario !== 0) return;
    const keysToDelete = [];
    for (const key of this.cache.keys()) {
      const decoded = this.decodeCacheKey(key);
      if (!decoded) continue;
      // Remover entradas onde o parâmetro contenha o idUsuario (por id numérico ou CPF)
      if (decoded.includes(`"idUsuario":${idUsuario}`) || decoded.includes(`"cpf":"${idUsuario}`) || decoded.includes(`_${idUsuario}`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => {
      this.cache.delete(key);
      this.cacheTimestamps.delete(key);
    });
  }
}

module.exports = DatabaseCache;

