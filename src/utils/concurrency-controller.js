/**
 * Controlador de Concorrência para operações PJE
 * Evita execução simultânea de operações que podem conflitar
 */
class ConcurrencyController {
  constructor() {
    if (ConcurrencyController.instance) {
      return ConcurrencyController.instance;
    }

    this.activeOperations = new Map();
    this.operationQueue = new Map();
    this.maxConcurrentOperations = 1; // PJE não suporta bem concorrência
    this.operationTimeout = 300000; // 5 minutos
    
    ConcurrencyController.instance = this;
  }

  /**
   * Obtém a instância singleton
   */
  static getInstance() {
    if (!ConcurrencyController.instance) {
      new ConcurrencyController();
    }
    return ConcurrencyController.instance;
  }

  /**
   * Executa operação com controle de concorrência
   */
  async executeWithConcurrencyControl(operationId, operation, priority = 'normal') {
    // Se operação já está ativa, aguarda conclusão
    if (this.activeOperations.has(operationId)) {
      this.log(`⏳ Operação ${operationId} já em execução, aguardando...`);
      return await this.waitForOperation(operationId);
    }

    // Se atingiu limite de operações simultâneas, enfileira
    if (this.activeOperations.size >= this.maxConcurrentOperations) {
      this.log(`🚦 Limite de concorrência atingido, enfileirando ${operationId}...`);
      return await this.enqueueOperation(operationId, operation, priority);
    }

    // Executa operação imediatamente
    return await this.executeOperation(operationId, operation);
  }

  /**
   * Executa operação e gerencia estado
   */
  async executeOperation(operationId, operation) {
    const startTime = Date.now();
    
    // Registra operação ativa
    const operationPromise = this.createOperationPromise(operation);
    this.activeOperations.set(operationId, {
      promise: operationPromise,
      startTime,
      timeout: setTimeout(() => {
        this.handleOperationTimeout(operationId);
      }, this.operationTimeout)
    });

    this.log(`🚀 Iniciando operação ${operationId}...`);

    try {
      const result = await operationPromise;
      this.log(`✅ Operação ${operationId} concluída em ${Date.now() - startTime}ms`);
      return result;
    } catch (error) {
      this.log(`❌ Operação ${operationId} falhou: ${error.message}`);
      throw error;
    } finally {
      this.cleanupOperation(operationId);
      this.processQueue();
    }
  }

  /**
   * Cria promise para operação com tratamento de erro
   */
  async createOperationPromise(operation) {
    try {
      return await operation();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Enfileira operação para execução posterior
   */
  async enqueueOperation(operationId, operation, priority) {
    return new Promise((resolve, reject) => {
      const queueItem = {
        operationId,
        operation,
        priority,
        resolve,
        reject,
        timestamp: Date.now()
      };

      if (!this.operationQueue.has(priority)) {
        this.operationQueue.set(priority, []);
      }

      this.operationQueue.get(priority).push(queueItem);
      this.log(`📋 Operação ${operationId} enfileirada (prioridade: ${priority})`);
    });
  }

  /**
   * Aguarda conclusão de operação existente
   */
  async waitForOperation(operationId) {
    const activeOp = this.activeOperations.get(operationId);
    if (activeOp) {
      try {
        return await activeOp.promise;
      } catch (error) {
        throw error;
      }
    }
    throw new Error(`Operação ${operationId} não encontrada`);
  }

  /**
   * Processa fila de operações
   */
  async processQueue() {
    if (this.activeOperations.size >= this.maxConcurrentOperations) {
      return;
    }

    // Processa por prioridade: high -> normal -> low
    const priorities = ['high', 'normal', 'low'];
    
    for (const priority of priorities) {
      const queue = this.operationQueue.get(priority);
      if (queue && queue.length > 0) {
        const queueItem = queue.shift();
        
        try {
          const result = await this.executeOperation(
            queueItem.operationId, 
            queueItem.operation
          );
          queueItem.resolve(result);
        } catch (error) {
          queueItem.reject(error);
        }
        
        break; // Processa apenas uma operação por vez
      }
    }
  }

  /**
   * Trata timeout de operação
   */
  handleOperationTimeout(operationId) {
    this.log(`⏰ Timeout da operação ${operationId}`);
    this.cleanupOperation(operationId);
    this.processQueue();
  }

  /**
   * Limpa operação do estado ativo
   */
  cleanupOperation(operationId) {
    const activeOp = this.activeOperations.get(operationId);
    if (activeOp) {
      clearTimeout(activeOp.timeout);
      this.activeOperations.delete(operationId);
    }
  }

  /**
   * Obtém estatísticas do controlador
   */
  getStats() {
    const queueSizes = {};
    for (const [priority, queue] of this.operationQueue) {
      queueSizes[priority] = queue.length;
    }

    return {
      activeOperations: this.activeOperations.size,
      maxConcurrentOperations: this.maxConcurrentOperations,
      queueSizes,
      totalQueued: Object.values(queueSizes).reduce((sum, size) => sum + size, 0)
    };
  }

  /**
   * Log com timestamp
   */
  log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [CONCURRENCY-CONTROLLER] ${message}`);
  }

  /**
   * Reset do singleton (para testes)
   */
  static reset() {
    ConcurrencyController.instance = null;
  }
}

module.exports = ConcurrencyController;