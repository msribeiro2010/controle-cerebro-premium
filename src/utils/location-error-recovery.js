/**
 * Sistema de Recuperação de Erros para Scanner de Localizações
 * 
 * Este módulo fornece funcionalidades de recuperação automática
 * e manual para falhas durante o escaneamento de localizações.
 */

const fs = require('fs').promises;
const path = require('path');
const Logger = require('./Logger');

class LocationErrorRecovery {
  constructor(options = {}) {
    this.logger = new Logger('LocationErrorRecovery');
        
    // Configurações
    this.config = {
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 2000, // 2 segundos
      backoffMultiplier: options.backoffMultiplier || 2,
      saveStateInterval: options.saveStateInterval || 30000, // 30 segundos
      stateFilePath: options.stateFilePath || path.join(process.cwd(), 'data', 'scanner-state.json'),
      errorLogPath: options.errorLogPath || path.join(process.cwd(), 'logs', 'scanner-errors.json'),
      enableAutoRecovery: options.enableAutoRecovery !== false,
      enableStateBackup: options.enableStateBackup !== false,
      criticalErrorThreshold: options.criticalErrorThreshold || 10 // Erros consecutivos
    };
        
    // Estado atual do scanner
    this.state = {
      sessionId: this.generateSessionId(),
      startTime: null,
      lastSaveTime: null,
      currentServer: null,
      currentLocation: null,
      processedServers: [],
      processedLocations: [],
      failedServers: [],
      failedLocations: [],
      retryQueue: [],
      consecutiveErrors: 0,
      totalErrors: 0,
      isRecovering: false,
      lastCheckpoint: null
    };
        
    // Tipos de erro e estratégias de recuperação
    this.errorStrategies = {
      'NETWORK_ERROR': {
        retryable: true,
        maxRetries: 5,
        delay: 3000,
        backoff: true
      },
      'TIMEOUT_ERROR': {
        retryable: true,
        maxRetries: 3,
        delay: 5000,
        backoff: true
      },
      'BROWSER_CRASH': {
        retryable: true,
        maxRetries: 2,
        delay: 10000,
        requiresRestart: true
      },
      'ELEMENT_NOT_FOUND': {
        retryable: true,
        maxRetries: 2,
        delay: 1000,
        backoff: false
      },
      'AUTHENTICATION_ERROR': {
        retryable: false,
        requiresManualIntervention: true
      },
      'CRITICAL_ERROR': {
        retryable: false,
        stopExecution: true
      }
    };
        
    // Timer para salvamento automático
    this.saveTimer = null;
        
    // Callbacks
    this.callbacks = {
      onErrorOccurred: options.onErrorOccurred || null,
      onRetryAttempt: options.onRetryAttempt || null,
      onRecoverySuccess: options.onRecoverySuccess || null,
      onRecoveryFailed: options.onRecoveryFailed || null,
      onCriticalError: options.onCriticalError || null,
      onStateRestored: options.onStateRestored || null
    };
  }
    
  /**
     * Inicia o sistema de recuperação
     */
  async initialize() {
    try {
      // Criar diretórios necessários
      await this.ensureDirectories();
            
      // Verificar se existe estado anterior
      const previousState = await this.loadPreviousState();
      if (previousState && previousState.sessionId !== this.state.sessionId) {
        this.logger.info('Estado anterior encontrado, oferecendo recuperação');
        return previousState;
      }
            
      // Iniciar novo estado
      this.state.startTime = Date.now();
      this.startAutoSave();
            
      this.logger.info(`Sistema de recuperação inicializado - Sessão: ${this.state.sessionId}`);
      return null;
            
    } catch (error) {
      this.logger.error('Erro ao inicializar sistema de recuperação:', error);
      throw error;
    }
  }
    
  /**
     * Restaura estado anterior
     */
  async restoreState(previousState) {
    try {
      this.state = {
        ...previousState,
        isRecovering: true,
        consecutiveErrors: 0 // Reset contador de erros consecutivos
      };
            
      this.logger.info(`Estado restaurado - Sessão: ${this.state.sessionId}`);
      this.logger.info(`Servidores processados: ${this.state.processedServers.length}`);
      this.logger.info(`Localizações processadas: ${this.state.processedLocations.length}`);
      this.logger.info(`Itens na fila de retry: ${this.state.retryQueue.length}`);
            
      if (this.callbacks.onStateRestored) {
        this.callbacks.onStateRestored(this.state);
      }
            
      this.startAutoSave();
      return true;
            
    } catch (error) {
      this.logger.error('Erro ao restaurar estado:', error);
      return false;
    }
  }
    
  /**
     * Registra início de processamento de servidor
     */
  startServer(serverInfo) {
    this.state.currentServer = {
      ...serverInfo,
      startTime: Date.now(),
      retryCount: 0
    };
        
    this.logger.debug(`Iniciando servidor: ${serverInfo.url}`);
  }
    
  /**
     * Registra início de processamento de localização
     */
  startLocation(locationInfo) {
    this.state.currentLocation = {
      ...locationInfo,
      startTime: Date.now(),
      retryCount: 0
    };
        
    this.logger.debug(`Iniciando localização: ${locationInfo.text}`);
  }
    
  /**
     * Registra sucesso no processamento
     */
  recordSuccess(type, item) {
    if (type === 'server') {
      this.state.processedServers.push({
        ...item,
        completedAt: Date.now()
      });
      this.state.currentServer = null;
    } else if (type === 'location') {
      this.state.processedLocations.push({
        ...item,
        completedAt: Date.now()
      });
      this.state.currentLocation = null;
    }
        
    // Reset contador de erros consecutivos em caso de sucesso
    this.state.consecutiveErrors = 0;
        
    this.createCheckpoint();
  }
    
  /**
     * Processa erro ocorrido
     */
  async handleError(error, context = {}) {
    try {
      this.state.totalErrors++;
      this.state.consecutiveErrors++;
            
      // Classificar tipo de erro
      const errorType = this.classifyError(error);
      const strategy = this.errorStrategies[errorType] || this.errorStrategies['CRITICAL_ERROR'];
            
      // Log do erro
      await this.logError(error, errorType, context);
            
      this.logger.warn(`Erro ${errorType} detectado: ${error.message}`);
            
      // Callback de erro
      if (this.callbacks.onErrorOccurred) {
        this.callbacks.onErrorOccurred(error, errorType, context, this.state);
      }
            
      // Verificar se é erro crítico
      if (strategy.stopExecution || this.state.consecutiveErrors >= this.config.criticalErrorThreshold) {
        return await this.handleCriticalError(error, errorType, context);
      }
            
      // Verificar se requer intervenção manual
      if (strategy.requiresManualIntervention) {
        return await this.handleManualIntervention(error, errorType, context);
      }
            
      // Tentar recuperação automática
      if (strategy.retryable && this.config.enableAutoRecovery) {
        return await this.attemptRecovery(error, errorType, strategy, context);
      }
            
      // Erro não recuperável
      return {
        success: false,
        action: 'skip',
        reason: 'Erro não recuperável',
        error
      };
            
    } catch (recoveryError) {
      this.logger.error('Erro durante recuperação:', recoveryError);
      return {
        success: false,
        action: 'abort',
        reason: 'Falha na recuperação',
        error: recoveryError
      };
    }
  }
    
  /**
     * Classifica tipo de erro
     */
  classifyError(error) {
    const message = error.message?.toLowerCase() || '';
    const code = error.code || '';
        
    if (message.includes('network') || message.includes('connection') || code === 'ECONNREFUSED') {
      return 'NETWORK_ERROR';
    }
        
    if (message.includes('timeout') || code === 'ETIMEDOUT') {
      return 'TIMEOUT_ERROR';
    }
        
    if (message.includes('browser') || message.includes('crash') || message.includes('disconnected')) {
      return 'BROWSER_CRASH';
    }
        
    if (message.includes('element') || message.includes('selector') || message.includes('not found')) {
      return 'ELEMENT_NOT_FOUND';
    }
        
    if (message.includes('auth') || message.includes('login') || message.includes('unauthorized')) {
      return 'AUTHENTICATION_ERROR';
    }
        
    return 'CRITICAL_ERROR';
  }
    
  /**
     * Tenta recuperação automática
     */
  async attemptRecovery(error, errorType, strategy, context) {
    const currentItem = context.type === 'server' ? this.state.currentServer : this.state.currentLocation;
        
    if (!currentItem) {
      return { success: false, action: 'skip', reason: 'Item atual não encontrado' };
    }
        
    const retryCount = currentItem.retryCount || 0;
    const maxRetries = strategy.maxRetries || this.config.maxRetries;
        
    if (retryCount >= maxRetries) {
      // Adicionar à lista de falhas
      if (context.type === 'server') {
        this.state.failedServers.push({ ...currentItem, error: error.message, finalRetryCount: retryCount });
      } else {
        this.state.failedLocations.push({ ...currentItem, error: error.message, finalRetryCount: retryCount });
      }
            
      this.logger.warn(`Máximo de tentativas excedido para ${context.type}: ${currentItem.url || currentItem.text}`);
            
      if (this.callbacks.onRecoveryFailed) {
        this.callbacks.onRecoveryFailed(error, errorType, currentItem, retryCount);
      }
            
      return { success: false, action: 'skip', reason: 'Máximo de tentativas excedido' };
    }
        
    // Calcular delay
    let delay = strategy.delay || this.config.retryDelay;
    if (strategy.backoff) {
      delay = delay * Math.pow(this.config.backoffMultiplier, retryCount);
    }
        
    // Incrementar contador de retry
    currentItem.retryCount = retryCount + 1;
        
    this.logger.info(`Tentativa ${currentItem.retryCount}/${maxRetries} para ${context.type}: ${currentItem.url || currentItem.text}`);
        
    if (this.callbacks.onRetryAttempt) {
      this.callbacks.onRetryAttempt(error, errorType, currentItem, currentItem.retryCount, delay);
    }
        
    // Aguardar delay
    await this.sleep(delay);
        
    // Adicionar à fila de retry se necessário
    if (strategy.requiresRestart) {
      this.state.retryQueue.push({
        type: context.type,
        item: currentItem,
        errorType,
        timestamp: Date.now()
      });
            
      return { success: true, action: 'restart_required', reason: 'Reinicialização necessária' };
    }
        
    return { success: true, action: 'retry', reason: 'Tentativa de recuperação', delay };
  }
    
  /**
     * Lida com erro crítico
     */
  async handleCriticalError(error, errorType, context) {
    this.logger.error(`Erro crítico detectado: ${error.message}`);
        
    // Salvar estado atual
    await this.saveState();
        
    if (this.callbacks.onCriticalError) {
      this.callbacks.onCriticalError(error, errorType, context, this.state);
    }
        
    return {
      success: false,
      action: 'abort',
      reason: 'Erro crítico - execução interrompida',
      error
    };
  }
    
  /**
     * Lida com erro que requer intervenção manual
     */
  async handleManualIntervention(error, errorType, context) {
    this.logger.warn(`Erro requer intervenção manual: ${error.message}`);
        
    // Salvar estado atual
    await this.saveState();
        
    return {
      success: false,
      action: 'manual_intervention',
      reason: 'Intervenção manual necessária',
      error
    };
  }
    
  /**
     * Processa fila de retry
     */
  async processRetryQueue() {
    if (this.state.retryQueue.length === 0) {
      return [];
    }
        
    this.logger.info(`Processando fila de retry: ${this.state.retryQueue.length} itens`);
        
    const retryItems = [...this.state.retryQueue];
    this.state.retryQueue = [];
        
    return retryItems;
  }
    
  /**
     * Cria checkpoint do estado atual
     */
  createCheckpoint() {
    this.state.lastCheckpoint = {
      timestamp: Date.now(),
      processedServers: this.state.processedServers.length,
      processedLocations: this.state.processedLocations.length,
      totalErrors: this.state.totalErrors
    };
  }
    
  /**
     * Salva estado atual
     */
  async saveState() {
    try {
      if (!this.config.enableStateBackup) return;
            
      this.state.lastSaveTime = Date.now();
            
      const stateData = {
        ...this.state,
        version: '1.0',
        savedAt: Date.now()
      };
            
      await fs.writeFile(this.config.stateFilePath, JSON.stringify(stateData, null, 2));
      this.logger.debug('Estado salvo com sucesso');
            
    } catch (error) {
      this.logger.error('Erro ao salvar estado:', error);
    }
  }
    
  /**
     * Carrega estado anterior
     */
  async loadPreviousState() {
    try {
      const data = await fs.readFile(this.config.stateFilePath, 'utf8');
      const state = JSON.parse(data);
            
      // Verificar se o estado é recente (menos de 24 horas)
      const maxAge = 24 * 60 * 60 * 1000; // 24 horas
      if (Date.now() - state.savedAt > maxAge) {
        this.logger.info('Estado anterior muito antigo, ignorando');
        return null;
      }
            
      return state;
            
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.warn('Erro ao carregar estado anterior:', error);
      }
      return null;
    }
  }
    
  /**
     * Log de erro
     */
  async logError(error, errorType, context) {
    try {
      const errorLog = {
        timestamp: Date.now(),
        sessionId: this.state.sessionId,
        errorType,
        message: error.message,
        stack: error.stack,
        context,
        currentServer: this.state.currentServer,
        currentLocation: this.state.currentLocation,
        consecutiveErrors: this.state.consecutiveErrors,
        totalErrors: this.state.totalErrors
      };
            
      // Ler logs existentes
      let logs = [];
      try {
        const data = await fs.readFile(this.config.errorLogPath, 'utf8');
        logs = JSON.parse(data);
      } catch (e) {
        // Arquivo não existe ou está vazio
      }
            
      // Adicionar novo log
      logs.push(errorLog);
            
      // Manter apenas os últimos 1000 logs
      if (logs.length > 1000) {
        logs = logs.slice(-1000);
      }
            
      // Salvar logs
      await fs.writeFile(this.config.errorLogPath, JSON.stringify(logs, null, 2));
            
    } catch (logError) {
      this.logger.error('Erro ao salvar log de erro:', logError);
    }
  }
    
  /**
     * Inicia salvamento automático
     */
  startAutoSave() {
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
    }
        
    this.saveTimer = setInterval(() => {
      this.saveState();
    }, this.config.saveStateInterval);
  }
    
  /**
     * Para salvamento automático
     */
  stopAutoSave() {
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
      this.saveTimer = null;
    }
  }
    
  /**
     * Garante que diretórios necessários existem
     */
  async ensureDirectories() {
    const dirs = [
      path.dirname(this.config.stateFilePath),
      path.dirname(this.config.errorLogPath)
    ];
        
    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        if (error.code !== 'EEXIST') {
          throw error;
        }
      }
    }
  }
    
  /**
     * Gera ID único para sessão
     */
  generateSessionId() {
    return `scanner_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
    
  /**
     * Utilitário para sleep
     */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
    
  /**
     * Gera relatório de recuperação
     */
  generateRecoveryReport() {
    const totalProcessed = this.state.processedServers.length + this.state.processedLocations.length;
    const totalFailed = this.state.failedServers.length + this.state.failedLocations.length;
    const totalItems = totalProcessed + totalFailed;
        
    return {
      session: {
        id: this.state.sessionId,
        startTime: new Date(this.state.startTime).toISOString(),
        duration: this.state.startTime ? Date.now() - this.state.startTime : 0,
        isRecovering: this.state.isRecovering
      },
      statistics: {
        totalErrors: this.state.totalErrors,
        consecutiveErrors: this.state.consecutiveErrors,
        successRate: totalItems > 0 ? ((totalProcessed / totalItems) * 100).toFixed(2) + '%' : '0%',
        errorRate: totalItems > 0 ? ((totalFailed / totalItems) * 100).toFixed(2) + '%' : '0%'
      },
      processed: {
        servers: this.state.processedServers.length,
        locations: this.state.processedLocations.length
      },
      failed: {
        servers: this.state.failedServers.length,
        locations: this.state.failedLocations.length
      },
      queue: {
        retryItems: this.state.retryQueue.length
      },
      lastCheckpoint: this.state.lastCheckpoint
    };
  }
    
  /**
     * Limpa recursos
     */
  async cleanup() {
    this.stopAutoSave();
        
    // Salvar estado final
    await this.saveState();
        
    this.logger.info('Sistema de recuperação finalizado');
  }
}

module.exports = LocationErrorRecovery;