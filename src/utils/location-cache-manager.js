/**
 * Gerenciador de Cache para Localizações
 * 
 * Este módulo gerencia o cache de localizações já processadas,
 * fornecendo verificação rápida e persistência de dados.
 */

const fs = require('fs').promises;
const path = require('path');
const Logger = require('./Logger');

class LocationCacheManager {
  constructor(options = {}) {
    this.logger = new Logger('LocationCacheManager');
        
    // Configurações
    this.config = {
      cacheDir: options.cacheDir || path.join(process.cwd(), 'data', 'cache'),
      cacheFile: options.cacheFile || 'location-cache.json',
      maxCacheSize: options.maxCacheSize || 10000,
      autoSave: options.autoSave !== false, // Default: true
      saveInterval: options.saveInterval || 30000, // 30 segundos
      compressionEnabled: options.compressionEnabled !== false
    };
        
    // Cache em memória
    this.cache = {
      locations: new Map(), // locationKey -> locationData
      servers: new Map(),   // serverKey -> serverData
      metadata: {
        lastUpdated: null,
        totalEntries: 0,
        version: '1.0.0'
      }
    };
        
    // Estatísticas
    this.stats = {
      hits: 0,
      misses: 0,
      saves: 0,
      loads: 0,
      errors: 0,
      lastSaveTime: null,
      lastLoadTime: null
    };
        
    // Timer para auto-save
    this.autoSaveTimer = null;
        
    // Flag de inicialização
    this.initialized = false;
  }
    
  /**
     * Inicializa o gerenciador de cache
     */
  async initialize() {
    try {
      this.logger.info('Inicializando gerenciador de cache de localizações...');
            
      // Criar diretório de cache se não existir
      await this.ensureCacheDirectory();
            
      // Carregar cache existente
      await this.loadCache();
            
      // Configurar auto-save
      if (this.config.autoSave) {
        this.setupAutoSave();
      }
            
      this.initialized = true;
      this.logger.info('Gerenciador de cache inicializado com sucesso');
            
      return true;
            
    } catch (error) {
      this.logger.error('Erro ao inicializar gerenciador de cache:', error);
      throw error;
    }
  }
    
  /**
     * Garante que o diretório de cache existe
     */
  async ensureCacheDirectory() {
    try {
      await fs.mkdir(this.config.cacheDir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }
    
  /**
     * Carrega o cache do arquivo
     */
  async loadCache() {
    try {
      const cacheFilePath = path.join(this.config.cacheDir, this.config.cacheFile);
            
      try {
        const data = await fs.readFile(cacheFilePath, 'utf8');
        const cacheData = JSON.parse(data);
                
        // Restaurar Maps
        this.cache.locations = new Map(cacheData.locations || []);
        this.cache.servers = new Map(cacheData.servers || []);
        this.cache.metadata = { ...this.cache.metadata, ...cacheData.metadata };
                
        this.stats.loads++;
        this.stats.lastLoadTime = Date.now();
                
        this.logger.info(`Cache carregado: ${this.cache.locations.size} localizações, ${this.cache.servers.size} servidores`);
                
      } catch (error) {
        if (error.code === 'ENOENT') {
          this.logger.info('Arquivo de cache não encontrado, iniciando com cache vazio');
        } else {
          throw error;
        }
      }
            
    } catch (error) {
      this.logger.error('Erro ao carregar cache:', error);
      this.stats.errors++;
      // Continuar com cache vazio em caso de erro
    }
  }
    
  /**
     * Salva o cache no arquivo
     */
  async saveCache() {
    try {
      const cacheFilePath = path.join(this.config.cacheDir, this.config.cacheFile);
            
      // Preparar dados para serialização
      const cacheData = {
        locations: Array.from(this.cache.locations.entries()),
        servers: Array.from(this.cache.servers.entries()),
        metadata: {
          ...this.cache.metadata,
          lastUpdated: Date.now(),
          totalEntries: this.cache.locations.size + this.cache.servers.size
        }
      };
            
      // Salvar arquivo
      await fs.writeFile(cacheFilePath, JSON.stringify(cacheData, null, 2));
            
      this.stats.saves++;
      this.stats.lastSaveTime = Date.now();
            
      this.logger.debug(`Cache salvo: ${this.cache.locations.size} localizações, ${this.cache.servers.size} servidores`);
            
    } catch (error) {
      this.logger.error('Erro ao salvar cache:', error);
      this.stats.errors++;
      throw error;
    }
  }
    
  /**
     * Configura o auto-save
     */
  setupAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }
        
    this.autoSaveTimer = setInterval(async () => {
      try {
        await this.saveCache();
      } catch (error) {
        this.logger.error('Erro no auto-save:', error);
      }
    }, this.config.saveInterval);
        
    this.logger.debug(`Auto-save configurado para ${this.config.saveInterval}ms`);
  }
    
  /**
     * Gera chave única para localização
     */
  generateLocationKey(serverUrl, locationValue, locationText) {
    const normalizedUrl = serverUrl.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normalizedValue = String(locationValue).toLowerCase().trim();
    const normalizedText = locationText.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
        
    return `${normalizedUrl}:${normalizedValue}:${normalizedText}`;
  }
    
  /**
     * Gera chave única para servidor
     */
  generateServerKey(serverUrl) {
    return serverUrl.toLowerCase().replace(/[^a-z0-9]/g, '');
  }
    
  /**
     * Verifica se uma localização já foi processada
     */
  isLocationProcessed(serverUrl, locationValue, locationText) {
    const key = this.generateLocationKey(serverUrl, locationValue, locationText);
    const exists = this.cache.locations.has(key);
        
    if (exists) {
      this.stats.hits++;
      this.logger.debug(`Cache HIT para localização: ${locationText}`);
    } else {
      this.stats.misses++;
      this.logger.debug(`Cache MISS para localização: ${locationText}`);
    }
        
    return exists;
  }
    
  /**
     * Marca uma localização como processada
     */
  markLocationAsProcessed(serverUrl, locationValue, locationText, metadata = {}) {
    const key = this.generateLocationKey(serverUrl, locationValue, locationText);
        
    const locationData = {
      serverUrl,
      locationValue,
      locationText,
      processedAt: Date.now(),
      metadata: {
        ...metadata,
        version: this.cache.metadata.version
      }
    };
        
    this.cache.locations.set(key, locationData);
        
    // Verificar limite de cache
    if (this.cache.locations.size > this.config.maxCacheSize) {
      this.cleanupOldEntries();
    }
        
    this.logger.debug(`Localização marcada como processada: ${locationText}`);
  }
    
  /**
     * Obtém dados de uma localização processada
     */
  getLocationData(serverUrl, locationValue, locationText) {
    const key = this.generateLocationKey(serverUrl, locationValue, locationText);
    return this.cache.locations.get(key) || null;
  }
    
  /**
     * Verifica se um servidor já foi analisado
     */
  isServerAnalyzed(serverUrl) {
    const key = this.generateServerKey(serverUrl);
    const exists = this.cache.servers.has(key);
        
    if (exists) {
      this.stats.hits++;
    } else {
      this.stats.misses++;
    }
        
    return exists;
  }
    
  /**
     * Marca um servidor como analisado
     */
  markServerAsAnalyzed(serverUrl, analysisData = {}) {
    const key = this.generateServerKey(serverUrl);
        
    const serverData = {
      serverUrl,
      analyzedAt: Date.now(),
      totalLocations: analysisData.totalLocations || 0,
      processedLocations: analysisData.processedLocations || 0,
      metadata: {
        ...analysisData,
        version: this.cache.metadata.version
      }
    };
        
    this.cache.servers.set(key, serverData);
    this.logger.debug(`Servidor marcado como analisado: ${serverUrl}`);
  }
    
  /**
     * Obtém dados de um servidor analisado
     */
  getServerData(serverUrl) {
    const key = this.generateServerKey(serverUrl);
    return this.cache.servers.get(key) || null;
  }
    
  /**
     * Remove entradas antigas do cache
     */
  cleanupOldEntries() {
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 dias
    const now = Date.now();
    let removedCount = 0;
        
    // Limpar localizações antigas
    for (const [key, data] of this.cache.locations.entries()) {
      if (now - data.processedAt > maxAge) {
        this.cache.locations.delete(key);
        removedCount++;
      }
    }
        
    // Limpar servidores antigos
    for (const [key, data] of this.cache.servers.entries()) {
      if (now - data.analyzedAt > maxAge) {
        this.cache.servers.delete(key);
        removedCount++;
      }
    }
        
    if (removedCount > 0) {
      this.logger.info(`Limpeza de cache: ${removedCount} entradas antigas removidas`);
    }
  }
    
  /**
     * Obtém localizações processadas para um servidor
     */
  getProcessedLocationsForServer(serverUrl) {
    const serverKey = this.generateServerKey(serverUrl);
    const locations = [];
        
    for (const [key, data] of this.cache.locations.entries()) {
      if (data.serverUrl.toLowerCase().replace(/[^a-z0-9]/g, '') === serverKey) {
        locations.push(data);
      }
    }
        
    return locations;
  }
    
  /**
     * Limpa todo o cache
     */
  clearCache() {
    this.cache.locations.clear();
    this.cache.servers.clear();
    this.cache.metadata.lastUpdated = Date.now();
    this.cache.metadata.totalEntries = 0;
        
    this.logger.info('Cache completamente limpo');
  }
    
  /**
     * Gera relatório de estatísticas do cache
     */
  generateCacheReport() {
    const hitRate = this.stats.hits + this.stats.misses > 0 
      ? ((this.stats.hits / (this.stats.hits + this.stats.misses)) * 100).toFixed(2)
      : 0;
        
    return {
      summary: {
        totalLocations: this.cache.locations.size,
        totalServers: this.cache.servers.size,
        totalEntries: this.cache.locations.size + this.cache.servers.size,
        cacheHitRate: `${hitRate}%`,
        lastUpdated: this.cache.metadata.lastUpdated ? new Date(this.cache.metadata.lastUpdated).toISOString() : null
      },
      performance: {
        hits: this.stats.hits,
        misses: this.stats.misses,
        saves: this.stats.saves,
        loads: this.stats.loads,
        errors: this.stats.errors,
        lastSaveTime: this.stats.lastSaveTime ? new Date(this.stats.lastSaveTime).toISOString() : null,
        lastLoadTime: this.stats.lastLoadTime ? new Date(this.stats.lastLoadTime).toISOString() : null
      },
      efficiency: {
        memoryUsage: `${(JSON.stringify(Array.from(this.cache.locations.entries())).length / 1024).toFixed(2)} KB`,
        averageLocationAge: this.calculateAverageAge('locations'),
        averageServerAge: this.calculateAverageAge('servers')
      }
    };
  }
    
  /**
     * Calcula idade média das entradas
     */
  calculateAverageAge(type) {
    const entries = type === 'locations' ? this.cache.locations : this.cache.servers;
    const now = Date.now();
    let totalAge = 0;
    let count = 0;
        
    for (const [key, data] of entries.entries()) {
      const timestamp = type === 'locations' ? data.processedAt : data.analyzedAt;
      totalAge += now - timestamp;
      count++;
    }
        
    if (count === 0) return '0h';
        
    const averageAgeMs = totalAge / count;
    const averageAgeHours = (averageAgeMs / (1000 * 60 * 60)).toFixed(1);
        
    return `${averageAgeHours}h`;
  }
    
  /**
     * Finaliza o gerenciador de cache
     */
  async cleanup() {
    try {
      // Parar auto-save
      if (this.autoSaveTimer) {
        clearInterval(this.autoSaveTimer);
        this.autoSaveTimer = null;
      }
            
      // Salvar cache final
      if (this.initialized) {
        await this.saveCache();
      }
            
      this.logger.info('Gerenciador de cache finalizado');
            
    } catch (error) {
      this.logger.error('Erro ao finalizar gerenciador de cache:', error);
    }
  }
}

module.exports = LocationCacheManager;