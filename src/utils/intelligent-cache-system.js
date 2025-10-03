/**
 * 🧠 INTELLIGENT CACHE SYSTEM
 * Sistema de cache inteligente para evitar reprocessamento desnecessário
 * Implementa cache multi-camadas com TTL adaptativo e invalidação inteligente
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class IntelligentCacheSystem {
  constructor(options = {}) {
    this.config = {
      // Cache em memória
      memory: {
        enabled: true,
        maxSize: options.memoryMaxSize || 1000,
        defaultTTL: options.memoryTTL || 300000, // 5 minutos
        cleanupInterval: options.cleanupInterval || 60000 // 1 minuto
      },
            
      // Cache em disco
      disk: {
        enabled: options.diskCache !== false,
        directory: options.cacheDir || path.join(process.cwd(), '.cache'),
        maxSize: options.diskMaxSize || 100, // 100 arquivos
        defaultTTL: options.diskTTL || 3600000 // 1 hora
      },
            
      // Cache inteligente
      intelligent: {
        enabled: true,
        adaptiveTTL: true,
        hitRateThreshold: 0.8, // 80% de hit rate para aumentar TTL
        missRateThreshold: 0.3, // 30% de miss rate para diminuir TTL
        ttlAdjustmentFactor: 1.5 // Fator de ajuste do TTL
      }
    };
        
    // Cache em memória
    this.memoryCache = new Map();
        
    // Estatísticas
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0,
      diskHits: 0,
      diskMisses: 0,
      totalTimeSaved: 0,
      operationsSaved: 0
    };
        
    // Metadados para cache inteligente
    this.metadata = new Map();
        
    // Inicializar limpeza automática
    this.startCleanupTimer();
        
    // Criar diretório de cache se necessário
    this.initializeDiskCache();
  }

  /**
     * 🚀 OBTER DADOS DO CACHE (MÉTODO PRINCIPAL)
     */
  async get(key, options = {}) {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(key);
        
    try {
      // 1. Tentar cache em memória primeiro
      const memoryResult = this.getFromMemory(cacheKey);
      if (memoryResult !== null) {
        this.recordHit('memory', Date.now() - startTime);
        console.log(`🎯 [CACHE] Hit em memória: ${key}`);
        return memoryResult;
      }
            
      // 2. Tentar cache em disco
      if (this.config.disk.enabled) {
        const diskResult = await this.getFromDisk(cacheKey);
        if (diskResult !== null) {
          // Promover para memória
          this.setInMemory(cacheKey, diskResult, options.ttl);
          this.recordHit('disk', Date.now() - startTime);
          console.log(`💾 [CACHE] Hit em disco (promovido): ${key}`);
          return diskResult;
        }
      }
            
      // 3. Cache miss
      this.recordMiss(Date.now() - startTime);
      console.log(`❌ [CACHE] Miss: ${key}`);
      return null;
            
    } catch (error) {
      console.error(`❌ [CACHE] Erro ao obter ${key}:`, error.message);
      this.recordMiss(Date.now() - startTime);
      return null;
    }
  }

  /**
     * 💾 ARMAZENAR DADOS NO CACHE
     */
  async set(key, value, options = {}) {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(key);
        
    try {
      // Calcular TTL inteligente
      const ttl = this.calculateIntelligentTTL(key, options.ttl);
            
      // Armazenar em memória
      this.setInMemory(cacheKey, value, ttl);
            
      // Armazenar em disco se habilitado
      if (this.config.disk.enabled && options.persistToDisk !== false) {
        await this.setOnDisk(cacheKey, value, ttl);
      }
            
      // Atualizar metadados
      this.updateMetadata(cacheKey, {
        key,
        size: this.calculateSize(value),
        createdAt: Date.now(),
        ttl,
        accessCount: 0,
        lastAccess: Date.now()
      });
            
      this.stats.sets++;
      console.log(`✅ [CACHE] Armazenado: ${key} (TTL: ${ttl}ms)`);
            
    } catch (error) {
      console.error(`❌ [CACHE] Erro ao armazenar ${key}:`, error.message);
    }
  }

  /**
     * 🧠 CACHE INTELIGENTE COM FUNÇÃO
     */
  async getOrCompute(key, computeFunction, options = {}) {
    const startTime = Date.now();
        
    // Tentar obter do cache
    const cached = await this.get(key, options);
    if (cached !== null) {
      return cached;
    }
        
    console.log(`🔄 [CACHE] Computando: ${key}`);
        
    try {
      // Computar valor
      const computeStartTime = Date.now();
      const value = await computeFunction();
      const computeTime = Date.now() - computeStartTime;
            
      // Armazenar no cache
      await this.set(key, value, {
        ...options,
        computeTime
      });
            
      // Registrar economia de tempo para próximas chamadas
      this.stats.totalTimeSaved += computeTime;
      this.stats.operationsSaved++;
            
      console.log(`✅ [CACHE] Computado e armazenado: ${key} (${computeTime}ms)`);
      return value;
            
    } catch (error) {
      console.error(`❌ [CACHE] Erro ao computar ${key}:`, error.message);
      throw error;
    }
  }

  /**
     * 🎯 CACHE ESPECÍFICO PARA OJs
     */
  async cacheOJAnalysis(servidor, analysisFunction) {
    const key = `oj_analysis_${servidor.cpf}_${servidor.nome}`;
        
    return await this.getOrCompute(key, analysisFunction, {
      ttl: 600000, // 10 minutos para análise de OJ
      category: 'oj_analysis',
      persistToDisk: true
    });
  }

  /**
     * 🔍 CACHE PARA RESULTADOS DE BUSCA
     */
  async cacheSearchResults(searchParams, searchFunction) {
    const key = `search_${this.hashObject(searchParams)}`;
        
    return await this.getOrCompute(key, searchFunction, {
      ttl: 300000, // 5 minutos para resultados de busca
      category: 'search_results',
      persistToDisk: false // Não persistir buscas em disco
    });
  }

  /**
     * 📊 CACHE PARA ESTATÍSTICAS
     */
  async cacheStats(statsKey, statsFunction) {
    const key = `stats_${statsKey}`;
        
    return await this.getOrCompute(key, statsFunction, {
      ttl: 60000, // 1 minuto para estatísticas
      category: 'statistics',
      persistToDisk: false
    });
  }

  /**
     * 🧮 CALCULAR TTL INTELIGENTE
     */
  calculateIntelligentTTL(key, requestedTTL) {
    if (!this.config.intelligent.adaptiveTTL) {
      return requestedTTL || this.config.memory.defaultTTL;
    }
        
    const hitRate = this.getHitRate();
    const baseTTL = requestedTTL || this.config.memory.defaultTTL;
        
    // Ajustar TTL baseado na taxa de hit
    if (hitRate > this.config.intelligent.hitRateThreshold) {
      // Alta taxa de hit - aumentar TTL
      return Math.round(baseTTL * this.config.intelligent.ttlAdjustmentFactor);
    } else if (hitRate < this.config.intelligent.missRateThreshold) {
      // Alta taxa de miss - diminuir TTL
      return Math.round(baseTTL / this.config.intelligent.ttlAdjustmentFactor);
    }
        
    return baseTTL;
  }

  /**
     * 💭 CACHE EM MEMÓRIA - GET
     */
  getFromMemory(cacheKey) {
    const item = this.memoryCache.get(cacheKey);
        
    if (!item) {
      return null;
    }
        
    // Verificar expiração
    if (Date.now() > item.expiresAt) {
      this.memoryCache.delete(cacheKey);
      this.metadata.delete(cacheKey);
      return null;
    }
        
    // Atualizar metadados de acesso
    const metadata = this.metadata.get(cacheKey);
    if (metadata) {
      metadata.accessCount++;
      metadata.lastAccess = Date.now();
    }
        
    return item.value;
  }

  /**
     * 💭 CACHE EM MEMÓRIA - SET
     */
  setInMemory(cacheKey, value, ttl) {
    const effectiveTTL = ttl || this.config.memory.defaultTTL;
    const expiresAt = Date.now() + effectiveTTL;
        
    // Verificar limite de tamanho
    if (this.memoryCache.size >= this.config.memory.maxSize) {
      this.evictLeastRecentlyUsed();
    }
        
    this.memoryCache.set(cacheKey, {
      value,
      createdAt: Date.now(),
      expiresAt
    });
  }

  /**
     * 💾 CACHE EM DISCO - GET
     */
  async getFromDisk(cacheKey) {
    try {
      const filePath = this.getDiskCachePath(cacheKey);
      const data = await fs.readFile(filePath, 'utf8');
      const item = JSON.parse(data);
            
      // Verificar expiração
      if (Date.now() > item.expiresAt) {
        await fs.unlink(filePath).catch(() => {}); // Ignorar erros de exclusão
        return null;
      }
            
      this.stats.diskHits++;
      return item.value;
            
    } catch (error) {
      this.stats.diskMisses++;
      return null;
    }
  }

  /**
     * 💾 CACHE EM DISCO - SET
     */
  async setOnDisk(cacheKey, value, ttl) {
    try {
      const effectiveTTL = ttl || this.config.disk.defaultTTL;
      const expiresAt = Date.now() + effectiveTTL;
            
      const item = {
        value,
        createdAt: Date.now(),
        expiresAt
      };
            
      const filePath = this.getDiskCachePath(cacheKey);
      await fs.writeFile(filePath, JSON.stringify(item), 'utf8');
            
    } catch (error) {
      console.error('❌ [CACHE] Erro ao salvar em disco:', error.message);
    }
  }

  /**
     * 🗑️ EVICÇÃO LRU (Least Recently Used)
     */
  evictLeastRecentlyUsed() {
    let oldestKey = null;
    let oldestTime = Date.now();
        
    for (const [key, metadata] of this.metadata.entries()) {
      if (metadata.lastAccess < oldestTime) {
        oldestTime = metadata.lastAccess;
        oldestKey = key;
      }
    }
        
    if (oldestKey) {
      this.memoryCache.delete(oldestKey);
      this.metadata.delete(oldestKey);
      this.stats.evictions++;
      console.log(`🗑️ [CACHE] Evictado: ${oldestKey}`);
    }
  }

  /**
     * 🧹 LIMPEZA AUTOMÁTICA
     */
  startCleanupTimer() {
    setInterval(() => {
      this.cleanup();
    }, this.config.memory.cleanupInterval);
  }

  /**
     * 🧹 EXECUTAR LIMPEZA
     */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
        
    // Limpar cache em memória
    for (const [key, item] of this.memoryCache.entries()) {
      if (now > item.expiresAt) {
        this.memoryCache.delete(key);
        this.metadata.delete(key);
        cleaned++;
      }
    }
        
    if (cleaned > 0) {
      console.log(`🧹 [CACHE] Limpeza: ${cleaned} itens removidos`);
    }
  }

  /**
     * 🔑 GERAR CHAVE DE CACHE
     */
  generateCacheKey(key) {
    if (typeof key === 'string') {
      return key;
    }
    return this.hashObject(key);
  }

  /**
     * #️⃣ HASH DE OBJETO
     */
  hashObject(obj) {
    const str = JSON.stringify(obj, Object.keys(obj).sort());
    return crypto.createHash('md5').update(str).digest('hex');
  }

  /**
     * 📏 CALCULAR TAMANHO
     */
  calculateSize(value) {
    return JSON.stringify(value).length;
  }

  /**
     * 📊 REGISTRAR HIT
     */
  recordHit(type, responseTime) {
    this.stats.hits++;
    if (type === 'disk') {
      this.stats.diskHits++;
    }
        
    // Estimar tempo economizado (baseado em operações típicas)
    const estimatedSavedTime = 2000; // 2 segundos por operação típica
    this.stats.totalTimeSaved += estimatedSavedTime;
    this.stats.operationsSaved++;
  }

  /**
     * 📊 REGISTRAR MISS
     */
  recordMiss(responseTime) {
    this.stats.misses++;
  }

  /**
     * 📈 CALCULAR TAXA DE HIT
     */
  getHitRate() {
    const total = this.stats.hits + this.stats.misses;
    return total > 0 ? this.stats.hits / total : 0;
  }

  /**
     * 📊 OBTER ESTATÍSTICAS
     */
  getStats() {
    const hitRate = this.getHitRate();
    const memoryUsage = this.memoryCache.size;
    const avgTimeSaved = this.stats.operationsSaved > 0 ? 
      Math.round(this.stats.totalTimeSaved / this.stats.operationsSaved) : 0;
        
    return {
      ...this.stats,
      hitRate: Math.round(hitRate * 100),
      memoryUsage,
      maxMemorySize: this.config.memory.maxSize,
      avgTimeSavedPerOperation: avgTimeSaved,
      totalTimeSavedSeconds: Math.round(this.stats.totalTimeSaved / 1000)
    };
  }

  /**
     * 📈 RELATÓRIO DE PERFORMANCE
     */
  generatePerformanceReport() {
    const stats = this.getStats();
        
    console.log('\n📈 ========== RELATÓRIO DE PERFORMANCE - CACHE ==========');
    console.log(`🎯 Taxa de hit: ${stats.hitRate}%`);
    console.log(`💭 Uso de memória: ${stats.memoryUsage}/${stats.maxMemorySize}`);
    console.log(`💾 Hits em disco: ${stats.diskHits}`);
    console.log(`📊 Total de operações: ${stats.hits + stats.misses}`);
    console.log(`⚡ Tempo total economizado: ${stats.totalTimeSavedSeconds}s`);
    console.log(`📉 Tempo médio economizado: ${stats.avgTimeSavedPerOperation}ms/operação`);
    console.log(`🗑️ Evicções: ${stats.evictions}`);
        
    // Eficiência do cache
    const efficiency = stats.hitRate;
    let efficiencyLevel = 'Baixa';
    if (efficiency > 80) efficiencyLevel = 'Excelente';
    else if (efficiency > 60) efficiencyLevel = 'Boa';
    else if (efficiency > 40) efficiencyLevel = 'Regular';
        
    console.log(`\n🏆 EFICIÊNCIA DO CACHE: ${efficiencyLevel} (${stats.hitRate}%)`);
        
    return stats;
  }

  /**
     * 🗂️ OBTER CAMINHO DO CACHE EM DISCO
     */
  getDiskCachePath(cacheKey) {
    return path.join(this.config.disk.directory, `${cacheKey}.json`);
  }

  /**
     * 🏗️ INICIALIZAR CACHE EM DISCO
     */
  async initializeDiskCache() {
    if (!this.config.disk.enabled) return;
        
    try {
      await fs.mkdir(this.config.disk.directory, { recursive: true });
    } catch (error) {
      console.error('❌ [CACHE] Erro ao criar diretório de cache:', error.message);
      this.config.disk.enabled = false;
    }
  }

  /**
     * 📝 ATUALIZAR METADADOS
     */
  updateMetadata(cacheKey, metadata) {
    this.metadata.set(cacheKey, metadata);
  }

  /**
     * 🧹 LIMPAR CACHE ESPECÍFICO
     */
  async invalidate(key) {
    const cacheKey = this.generateCacheKey(key);
        
    // Remover da memória
    this.memoryCache.delete(cacheKey);
    this.metadata.delete(cacheKey);
        
    // Remover do disco
    if (this.config.disk.enabled) {
      try {
        const filePath = this.getDiskCachePath(cacheKey);
        await fs.unlink(filePath);
      } catch (error) {
        // Ignorar se arquivo não existe
      }
    }
        
    console.log(`🧹 [CACHE] Invalidado: ${key}`);
  }

  /**
     * 🗑️ LIMPAR TODO O CACHE
     */
  async clear() {
    // Limpar memória
    this.memoryCache.clear();
    this.metadata.clear();
        
    // Limpar disco
    if (this.config.disk.enabled) {
      try {
        const files = await fs.readdir(this.config.disk.directory);
        await Promise.all(
          files.filter(f => f.endsWith('.json'))
            .map(f => fs.unlink(path.join(this.config.disk.directory, f)))
        );
      } catch (error) {
        console.error('❌ [CACHE] Erro ao limpar disco:', error.message);
      }
    }
        
    console.log('🗑️ [CACHE] Cache completamente limpo');
  }

  /**
     * 🔄 RESETAR ESTATÍSTICAS
     */
  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0,
      diskHits: 0,
      diskMisses: 0,
      totalTimeSaved: 0,
      operationsSaved: 0
    };
    console.log('🔄 [CACHE] Estatísticas resetadas');
  }
}

module.exports = IntelligentCacheSystem;