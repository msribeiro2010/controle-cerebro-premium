const PJEAvailabilityMonitor = require('../../pje-availability-monitor.js');

/**
 * Singleton para gerenciar uma única instância do PJEAvailabilityMonitor
 * Evita verificações duplicadas simultâneas do PJE
 */
class SingletonAvailabilityMonitor {
  constructor() {
    if (SingletonAvailabilityMonitor.instance) {
      return SingletonAvailabilityMonitor.instance;
    }

    this.monitor = new PJEAvailabilityMonitor();
    this.isChecking = false;
    this.lastCheckTime = 0;
    this.lastResult = null;
    this.checkInterval = 30000; // 30 segundos
    this.pendingChecks = [];
    
    SingletonAvailabilityMonitor.instance = this;
  }

  /**
   * Obtém a instância singleton
   */
  static getInstance() {
    if (!SingletonAvailabilityMonitor.instance) {
      new SingletonAvailabilityMonitor();
    }
    return SingletonAvailabilityMonitor.instance;
  }

  /**
   * Executa verificação única com controle de concorrência
   */
  async singleCheck(force = false) {
    const now = Date.now();
    
    // Se não forçado e temos resultado recente, retorna cache
    if (!force && this.lastResult !== null && 
        (now - this.lastCheckTime) < this.checkInterval) {
      this.log(`📋 Usando resultado em cache (${Math.round((now - this.lastCheckTime)/1000)}s atrás)`);
      return this.lastResult;
    }

    // Se já está verificando, aguarda o resultado
    if (this.isChecking) {
      this.log('⏳ Verificação já em andamento, aguardando resultado...');
      return new Promise((resolve) => {
        this.pendingChecks.push(resolve);
      });
    }

    // Inicia nova verificação
    this.isChecking = true;
    this.log('🔍 Iniciando verificação única de disponibilidade do PJE...');

    try {
      const result = await this.monitor.singleCheck();
      this.lastResult = result;
      this.lastCheckTime = now;
      
      // Resolve todas as verificações pendentes
      this.pendingChecks.forEach(resolve => resolve(result));
      this.pendingChecks = [];
      
      return result;
    } catch (error) {
      this.log(`❌ Erro na verificação: ${error.message}`);
      
      // Resolve verificações pendentes com erro
      this.pendingChecks.forEach(resolve => resolve(false));
      this.pendingChecks = [];
      
      throw error;
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Inicia monitoramento contínuo
   */
  async startMonitoring(duration = 300000) {
    return await this.monitor.startMonitoring(duration);
  }

  /**
   * Obtém estatísticas do monitor
   */
  getStats() {
    return {
      lastCheckTime: this.lastCheckTime,
      lastResult: this.lastResult,
      isChecking: this.isChecking,
      pendingChecks: this.pendingChecks.length,
      checkInterval: this.checkInterval
    };
  }

  /**
   * Log com timestamp
   */
  log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [SINGLETON-MONITOR] ${message}`);
  }

  /**
   * Reset do singleton (para testes)
   */
  static reset() {
    SingletonAvailabilityMonitor.instance = null;
  }
}

module.exports = SingletonAvailabilityMonitor;