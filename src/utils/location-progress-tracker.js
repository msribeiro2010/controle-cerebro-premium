/**
 * Rastreador de Progresso para Scanner de Localizações
 * 
 * Este módulo fornece rastreamento detalhado de progresso durante
 * o escaneamento de localizações, com callbacks para UI e relatórios.
 */

const Logger = require('./Logger');
const EventEmitter = require('events');

class LocationProgressTracker extends EventEmitter {
  constructor(options = {}) {
    super();
    this.logger = new Logger('LocationProgressTracker');
        
    // Configurações
    this.config = {
      updateInterval: options.updateInterval || 1000, // 1 segundo
      enableDetailedLogging: options.enableDetailedLogging !== false,
      enablePerformanceMetrics: options.enablePerformanceMetrics !== false,
      maxHistorySize: options.maxHistorySize || 1000
    };
        
    // Estado do progresso
    this.progress = {
      currentServer: null,
      currentLocation: null,
      serversTotal: 0,
      serversProcessed: 0,
      locationsTotal: 0,
      locationsProcessed: 0,
      locationsSkipped: 0,
      locationsError: 0,
      startTime: null,
      lastUpdateTime: null,
      estimatedTimeRemaining: null,
      currentPhase: 'idle' // idle, scanning, processing, complete
    };
        
    // Histórico de performance
    this.history = {
      servers: [],
      locations: [],
      errors: [],
      skips: []
    };
        
    // Métricas de performance
    this.metrics = {
      averageLocationTime: 0,
      averageServerTime: 0,
      skipRate: 0,
      errorRate: 0,
      throughput: 0, // localizações por minuto
      efficiency: 0 // % de localizações processadas vs puladas
    };
        
    // Timer para atualizações periódicas
    this.updateTimer = null;
        
    // Callbacks
    this.callbacks = {
      onProgressUpdate: options.onProgressUpdate || null,
      onServerStart: options.onServerStart || null,
      onServerComplete: options.onServerComplete || null,
      onLocationStart: options.onLocationStart || null,
      onLocationComplete: options.onLocationComplete || null,
      onLocationSkipped: options.onLocationSkipped || null,
      onLocationError: options.onLocationError || null,
      onPhaseChange: options.onPhaseChange || null
    };
  }
    
  /**
     * Inicia o rastreamento de progresso
     */
  startTracking(serversTotal = 0) {
    this.progress.serversTotal = serversTotal;
    this.progress.startTime = Date.now();
    this.progress.lastUpdateTime = Date.now();
    this.progress.currentPhase = 'scanning';
        
    // Iniciar timer de atualizações
    this.startUpdateTimer();
        
    this.logger.info(`Iniciando rastreamento de progresso para ${serversTotal} servidores`);
        
    this.emitPhaseChange('scanning');
    this.emitProgressUpdate();
  }
    
  /**
     * Inicia processamento de um servidor
     */
  startServer(serverInfo) {
    this.progress.currentServer = serverInfo;
    this.progress.locationsTotal = 0;
    this.progress.locationsProcessed = 0;
    this.progress.locationsSkipped = 0;
    this.progress.locationsError = 0;
        
    this.logger.info(`Iniciando servidor: ${serverInfo.url || serverInfo.name}`);
        
    if (this.callbacks.onServerStart) {
      this.callbacks.onServerStart(serverInfo, this.getProgressSnapshot());
    }
        
    this.emit('serverStart', serverInfo, this.getProgressSnapshot());
  }
    
  /**
     * Define total de localizações para o servidor atual
     */
  setLocationsTotal(total) {
    this.progress.locationsTotal = total;
    this.logger.debug(`Total de localizações definido: ${total}`);
    this.emitProgressUpdate();
  }
    
  /**
     * Inicia processamento de uma localização
     */
  startLocation(locationInfo) {
    this.progress.currentLocation = {
      ...locationInfo,
      startTime: Date.now()
    };
        
    if (this.config.enableDetailedLogging) {
      this.logger.debug(`Iniciando localização: ${locationInfo.text}`);
    }
        
    if (this.callbacks.onLocationStart) {
      this.callbacks.onLocationStart(locationInfo, this.getProgressSnapshot());
    }
        
    this.emit('locationStart', locationInfo, this.getProgressSnapshot());
  }
    
  /**
     * Completa processamento de uma localização
     */
  completeLocation(locationInfo, result = {}) {
    const processingTime = Date.now() - (this.progress.currentLocation?.startTime || Date.now());
        
    this.progress.locationsProcessed++;
    this.progress.lastUpdateTime = Date.now();
        
    // Adicionar ao histórico
    if (this.history.locations.length >= this.config.maxHistorySize) {
      this.history.locations.shift();
    }
        
    this.history.locations.push({
      ...locationInfo,
      processingTime,
      result,
      timestamp: Date.now()
    });
        
    // Atualizar métricas
    this.updateMetrics();
        
    if (this.config.enableDetailedLogging) {
      this.logger.debug(`Localização completada: ${locationInfo.text} (${processingTime}ms)`);
    }
        
    if (this.callbacks.onLocationComplete) {
      this.callbacks.onLocationComplete(locationInfo, result, this.getProgressSnapshot());
    }
        
    this.emit('locationComplete', locationInfo, result, this.getProgressSnapshot());
    this.emitProgressUpdate();
  }
    
  /**
     * Marca localização como pulada
     */
  skipLocation(locationInfo, reason = '') {
    this.progress.locationsSkipped++;
    this.progress.lastUpdateTime = Date.now();
        
    // Adicionar ao histórico
    if (this.history.skips.length >= this.config.maxHistorySize) {
      this.history.skips.shift();
    }
        
    this.history.skips.push({
      ...locationInfo,
      reason,
      timestamp: Date.now()
    });
        
    // Atualizar métricas
    this.updateMetrics();
        
    if (this.config.enableDetailedLogging) {
      this.logger.debug(`Localização pulada: ${locationInfo.text} - ${reason}`);
    }
        
    if (this.callbacks.onLocationSkipped) {
      this.callbacks.onLocationSkipped(locationInfo, reason, this.getProgressSnapshot());
    }
        
    this.emit('locationSkipped', locationInfo, reason, this.getProgressSnapshot());
    this.emitProgressUpdate();
  }
    
  /**
     * Marca localização com erro
     */
  errorLocation(locationInfo, error) {
    this.progress.locationsError++;
    this.progress.lastUpdateTime = Date.now();
        
    // Adicionar ao histórico
    if (this.history.errors.length >= this.config.maxHistorySize) {
      this.history.errors.shift();
    }
        
    this.history.errors.push({
      ...locationInfo,
      error: error.message || error,
      timestamp: Date.now()
    });
        
    // Atualizar métricas
    this.updateMetrics();
        
    this.logger.warn(`Erro na localização ${locationInfo.text}: ${error.message || error}`);
        
    if (this.callbacks.onLocationError) {
      this.callbacks.onLocationError(locationInfo, error, this.getProgressSnapshot());
    }
        
    this.emit('locationError', locationInfo, error, this.getProgressSnapshot());
    this.emitProgressUpdate();
  }
    
  /**
     * Completa processamento de um servidor
     */
  completeServer(serverInfo, result = {}) {
    const serverProcessingTime = Date.now() - (this.progress.currentServer?.startTime || Date.now());
        
    this.progress.serversProcessed++;
    this.progress.lastUpdateTime = Date.now();
        
    // Adicionar ao histórico
    if (this.history.servers.length >= this.config.maxHistorySize) {
      this.history.servers.shift();
    }
        
    this.history.servers.push({
      ...serverInfo,
      processingTime: serverProcessingTime,
      locationsTotal: this.progress.locationsTotal,
      locationsProcessed: this.progress.locationsProcessed,
      locationsSkipped: this.progress.locationsSkipped,
      locationsError: this.progress.locationsError,
      result,
      timestamp: Date.now()
    });
        
    // Atualizar métricas
    this.updateMetrics();
        
    this.logger.info(`Servidor completado: ${serverInfo.url || serverInfo.name} (${serverProcessingTime}ms)`);
        
    if (this.callbacks.onServerComplete) {
      this.callbacks.onServerComplete(serverInfo, result, this.getProgressSnapshot());
    }
        
    this.emit('serverComplete', serverInfo, result, this.getProgressSnapshot());
    this.emitProgressUpdate();
  }
    
  /**
     * Finaliza o rastreamento
     */
  completeTracking() {
    this.progress.currentPhase = 'complete';
    this.progress.lastUpdateTime = Date.now();
        
    // Parar timer
    this.stopUpdateTimer();
        
    // Atualizar métricas finais
    this.updateMetrics();
        
    this.logger.info('Rastreamento de progresso finalizado');
        
    this.emitPhaseChange('complete');
    this.emitProgressUpdate();
  }
    
  /**
     * Atualiza métricas de performance
     */
  updateMetrics() {
    const now = Date.now();
    const totalTime = now - this.progress.startTime;
    const totalLocations = this.progress.locationsProcessed + this.progress.locationsSkipped + this.progress.locationsError;
        
    // Tempo médio por localização
    if (this.history.locations.length > 0) {
      const totalProcessingTime = this.history.locations.reduce((sum, loc) => sum + loc.processingTime, 0);
      this.metrics.averageLocationTime = totalProcessingTime / this.history.locations.length;
    }
        
    // Tempo médio por servidor
    if (this.history.servers.length > 0) {
      const totalServerTime = this.history.servers.reduce((sum, srv) => sum + srv.processingTime, 0);
      this.metrics.averageServerTime = totalServerTime / this.history.servers.length;
    }
        
    // Taxa de pulo
    if (totalLocations > 0) {
      this.metrics.skipRate = (this.progress.locationsSkipped / totalLocations) * 100;
    }
        
    // Taxa de erro
    if (totalLocations > 0) {
      this.metrics.errorRate = (this.progress.locationsError / totalLocations) * 100;
    }
        
    // Throughput (localizações por minuto)
    if (totalTime > 0) {
      this.metrics.throughput = (totalLocations / totalTime) * 60000;
    }
        
    // Eficiência
    if (totalLocations > 0) {
      this.metrics.efficiency = (this.progress.locationsProcessed / totalLocations) * 100;
    }
        
    // Tempo estimado restante
    if (this.metrics.averageLocationTime > 0 && this.progress.locationsTotal > 0) {
      const remainingLocations = this.progress.locationsTotal - totalLocations;
      this.progress.estimatedTimeRemaining = remainingLocations * this.metrics.averageLocationTime;
    }
  }
    
  /**
     * Inicia timer de atualizações periódicas
     */
  startUpdateTimer() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }
        
    this.updateTimer = setInterval(() => {
      this.updateMetrics();
      this.emitProgressUpdate();
    }, this.config.updateInterval);
  }
    
  /**
     * Para timer de atualizações
     */
  stopUpdateTimer() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }
    
  /**
     * Emite atualização de progresso
     */
  emitProgressUpdate() {
    const snapshot = this.getProgressSnapshot();
        
    if (this.callbacks.onProgressUpdate) {
      this.callbacks.onProgressUpdate(snapshot);
    }
        
    this.emit('progressUpdate', snapshot);
  }
    
  /**
     * Emite mudança de fase
     */
  emitPhaseChange(newPhase) {
    const oldPhase = this.progress.currentPhase;
    this.progress.currentPhase = newPhase;
        
    if (this.callbacks.onPhaseChange) {
      this.callbacks.onPhaseChange(oldPhase, newPhase, this.getProgressSnapshot());
    }
        
    this.emit('phaseChange', oldPhase, newPhase, this.getProgressSnapshot());
  }
    
  /**
     * Obtém snapshot do progresso atual
     */
  getProgressSnapshot() {
    const totalTime = Date.now() - this.progress.startTime;
    const totalLocations = this.progress.locationsProcessed + this.progress.locationsSkipped + this.progress.locationsError;
        
    return {
      progress: { ...this.progress },
      metrics: { ...this.metrics },
      summary: {
        totalTime,
        totalLocations,
        serverProgress: this.progress.serversTotal > 0 
          ? (this.progress.serversProcessed / this.progress.serversTotal) * 100 
          : 0,
        locationProgress: this.progress.locationsTotal > 0 
          ? (totalLocations / this.progress.locationsTotal) * 100 
          : 0,
        overallProgress: this.calculateOverallProgress()
      },
      history: {
        recentServers: this.history.servers.slice(-5),
        recentLocations: this.history.locations.slice(-10),
        recentErrors: this.history.errors.slice(-5),
        recentSkips: this.history.skips.slice(-10)
      }
    };
  }
    
  /**
     * Calcula progresso geral
     */
  calculateOverallProgress() {
    if (this.progress.serversTotal === 0) return 0;
        
    const serverWeight = 0.3; // 30% do progresso baseado em servidores
    const locationWeight = 0.7; // 70% do progresso baseado em localizações
        
    const serverProgress = (this.progress.serversProcessed / this.progress.serversTotal) * 100;
    const totalLocations = this.progress.locationsProcessed + this.progress.locationsSkipped + this.progress.locationsError;
    const locationProgress = this.progress.locationsTotal > 0 
      ? (totalLocations / this.progress.locationsTotal) * 100 
      : 0;
        
    return (serverProgress * serverWeight) + (locationProgress * locationWeight);
  }
    
  /**
     * Gera relatório de progresso
     */
  generateProgressReport() {
    const snapshot = this.getProgressSnapshot();
    const totalTime = snapshot.summary.totalTime;
        
    return {
      summary: {
        phase: this.progress.currentPhase,
        totalTime: `${(totalTime / 1000).toFixed(2)}s`,
        overallProgress: `${snapshot.summary.overallProgress.toFixed(2)}%`,
        serversProgress: `${this.progress.serversProcessed}/${this.progress.serversTotal}`,
        locationsProgress: `${snapshot.summary.totalLocations}/${this.progress.locationsTotal}`,
        estimatedTimeRemaining: this.progress.estimatedTimeRemaining 
          ? `${(this.progress.estimatedTimeRemaining / 1000).toFixed(0)}s`
          : 'N/A'
      },
      performance: {
        averageLocationTime: `${this.metrics.averageLocationTime.toFixed(0)}ms`,
        averageServerTime: `${(this.metrics.averageServerTime / 1000).toFixed(2)}s`,
        throughput: `${this.metrics.throughput.toFixed(2)} loc/min`,
        skipRate: `${this.metrics.skipRate.toFixed(2)}%`,
        errorRate: `${this.metrics.errorRate.toFixed(2)}%`,
        efficiency: `${this.metrics.efficiency.toFixed(2)}%`
      },
      current: {
        server: this.progress.currentServer?.url || this.progress.currentServer?.name || 'N/A',
        location: this.progress.currentLocation?.text || 'N/A'
      }
    };
  }
    
  /**
     * Limpa recursos
     */
  cleanup() {
    this.stopUpdateTimer();
    this.removeAllListeners();
    this.logger.info('Rastreador de progresso finalizado');
  }
}

module.exports = LocationProgressTracker;