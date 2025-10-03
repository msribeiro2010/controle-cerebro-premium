/**
 * ⚡ SPEED INTEGRATION MANAGER
 * Gerenciador de integração das otimizações de velocidade
 * Aplica as melhorias de performance nos módulos principais do sistema
 */

const PerformanceOptimizer = require('./performance-optimizer');
const UltraSpeedConfig = require('./ultra-speed-config');
const TimeoutManager = require('./timeouts');

class SpeedIntegrationManager {
  constructor(options = {}) {
    this.config = {
      // Configurações globais de velocidade
      globalSpeedMode: options.globalSpeedMode || 'TURBO',
      enableAutoOptimization: options.enableAutoOptimization !== false,
      enablePerformanceMonitoring: options.enablePerformanceMonitoring !== false,
      
      // Configurações específicas por módulo
      moduleConfigs: {
        automation: {
          speedMode: 'TURBO',
          enableParallelProcessing: true,
          enableAggressiveCache: true,
          maxParallelInstances: 3
        },
        ojProcessing: {
          speedMode: 'ULTRA',
          enableBatchProcessing: true,
          enableTimeoutOptimization: true,
          maxBatchSize: 8
        },
        serverProcessing: {
          speedMode: 'TURBO',
          enableParallelProcessing: true,
          enableBatchProcessing: true,
          maxParallelInstances: 5,
          maxBatchSize: 10
        },
        database: {
          speedMode: 'ULTRA',
          enableAggressiveCache: true,
          enableTimeoutOptimization: true
        }
      }
    };
    
    this.optimizers = new Map();
    this.performanceMetrics = new Map();
    this.activeOptimizations = new Set();
    
    console.log('⚡ Speed Integration Manager inicializado');
    this.initializeOptimizers();
  }

  /**
   * 🚀 INICIALIZAÇÃO DOS OTIMIZADORES
   */
  initializeOptimizers() {
    // Configurar TimeoutManager global
    if (TimeoutManager && TimeoutManager.configurarModo) {
      // Mapear modo ULTRA para ultraRapido
      const modoTimeoutManager = this.config.globalSpeedMode === 'ULTRA' ? 'ultraRapido' : 
        this.config.globalSpeedMode === 'FAST' ? 'rapido' : 'normal';
      TimeoutManager.configurarModo(modoTimeoutManager);
      console.log(`⏱️ TimeoutManager configurado para modo ${modoTimeoutManager}`);
    }
    
    // Configurar UltraSpeedConfig global
    if (UltraSpeedConfig && UltraSpeedConfig.setGlobalMode) {
      UltraSpeedConfig.setGlobalMode(this.config.globalSpeedMode);
      console.log(`🚀 UltraSpeedConfig configurado para modo ${this.config.globalSpeedMode}`);
    }
  }

  /**
   * 🎯 OBTER OTIMIZADOR PARA MÓDULO ESPECÍFICO
   */
  getOptimizerForModule(moduleName, page = null, logger = console) {
    if (this.optimizers.has(moduleName)) {
      return this.optimizers.get(moduleName);
    }
    
    const moduleConfig = this.config.moduleConfigs[moduleName] || {
      speedMode: this.config.globalSpeedMode,
      enableParallelProcessing: true,
      enableAggressiveCache: true
    };
    
    const optimizer = new PerformanceOptimizer(page, logger, moduleConfig);
    this.optimizers.set(moduleName, optimizer);
    
    console.log(`⚡ Otimizador criado para módulo: ${moduleName} (modo: ${moduleConfig.speedMode})`);
    return optimizer;
  }

  /**
   * 🚀 APLICAR OTIMIZAÇÕES AUTOMÁTICAS
   */
  async applyAutomaticOptimizations(moduleName, operations = []) {
    if (!this.config.enableAutoOptimization) {
      return operations;
    }
    
    const optimizer = this.getOptimizerForModule(moduleName);
    const optimizedOperations = [];
    
    console.log(`⚡ Aplicando otimizações automáticas para ${moduleName} - ${operations.length} operações`);
    
    // Determinar se usar processamento em lote ou paralelo
    const moduleConfig = this.config.moduleConfigs[moduleName] || {};
    
    if (moduleConfig.enableBatchProcessing && operations.length > 3) {
      // Processamento em lote
      const results = await optimizer.optimizeBatchProcessing(
        operations,
        async (operation) => await this.executeOptimizedOperation(operation, optimizer),
        { batchSize: moduleConfig.maxBatchSize }
      );
      optimizedOperations.push(...results);
    } else if (moduleConfig.enableParallelProcessing && operations.length > 1) {
      // Processamento paralelo
      const results = await optimizer.processParallelBatch(
        operations,
        async (operation) => await this.executeOptimizedOperation(operation, optimizer)
      );
      optimizedOperations.push(...results);
    } else {
      // Processamento sequencial otimizado
      for (const operation of operations) {
        const result = await this.executeOptimizedOperation(operation, optimizer);
        optimizedOperations.push(result);
      }
    }
    
    this.activeOptimizations.add(moduleName);
    return optimizedOperations;
  }

  /**
   * 🎯 EXECUTAR OPERAÇÃO OTIMIZADA
   */
  async executeOptimizedOperation(operation, optimizer) {
    if (typeof operation === 'function') {
      return await optimizer.optimizeOperation(
        'custom_operation',
        operation,
        { module: 'auto' }
      );
    } else if (operation && operation.type && operation.function) {
      return await optimizer.optimizeOperation(
        operation.type,
        operation.function,
        operation.context || {}
      );
    } else {
      // Operação simples
      return operation;
    }
  }

  /**
   * ⚡ OTIMIZAR PROCESSAMENTO DE SERVIDORES
   */
  async optimizeServerProcessing(servers, processFunction) {
    console.log(`🖥️ Otimizando processamento de ${servers.length} servidores`);
    
    const optimizer = this.getOptimizerForModule('serverProcessing');
    
    // Configurações específicas para servidores
    const serverConfig = this.config.moduleConfigs.serverProcessing;
    
    return await optimizer.optimizeBatchProcessing(
      servers,
      processFunction,
      {
        batchSize: serverConfig.maxBatchSize,
        enableParallel: serverConfig.enableParallelProcessing
      }
    );
  }

  /**
   * 🏛️ OTIMIZAR PROCESSAMENTO DE OJS
   */
  async optimizeOJProcessing(ojs, processFunction) {
    console.log(`🏛️ Otimizando processamento de ${ojs.length} OJs`);
    
    const optimizer = this.getOptimizerForModule('ojProcessing');
    
    // Configurações específicas para OJs
    const ojConfig = this.config.moduleConfigs.ojProcessing;
    
    return await optimizer.optimizeBatchProcessing(
      ojs,
      processFunction,
      {
        batchSize: ojConfig.maxBatchSize,
        enableTimeoutOptimization: ojConfig.enableTimeoutOptimization
      }
    );
  }

  /**
   * 🤖 OTIMIZAR AUTOMAÇÃO
   */
  async optimizeAutomation(automationSteps, page, logger) {
    console.log(`🤖 Otimizando ${automationSteps.length} passos de automação`);
    
    const optimizer = this.getOptimizerForModule('automation', page, logger);
    
    const optimizedSteps = [];
    for (const step of automationSteps) {
      const optimizedStep = await optimizer.optimizeOperation(
        step.type || 'automation_step',
        step.function || (() => step),
        step.context || {}
      );
      optimizedSteps.push(optimizedStep);
    }
    
    return optimizedSteps;
  }

  /**
   * 💾 OTIMIZAR OPERAÇÕES DE BANCO
   */
  async optimizeDatabaseOperations(operations) {
    console.log(`💾 Otimizando ${operations.length} operações de banco`);
    
    const optimizer = this.getOptimizerForModule('database');
    
    return await optimizer.optimizeBatchProcessing(
      operations,
      async (operation) => {
        if (typeof operation === 'function') {
          return await operation();
        }
        return operation;
      },
      { enableCache: true }
    );
  }

  /**
   * 📊 MONITORAMENTO DE PERFORMANCE
   */
  startPerformanceMonitoring(moduleName) {
    if (!this.config.enablePerformanceMonitoring) return;
    
    const startTime = Date.now();
    this.performanceMetrics.set(moduleName, {
      startTime,
      operations: 0,
      optimizations: 0,
      errors: 0
    });
    
    console.log(`📊 Monitoramento de performance iniciado para: ${moduleName}`);
  }

  stopPerformanceMonitoring(moduleName) {
    const metrics = this.performanceMetrics.get(moduleName);
    if (!metrics) return null;
    
    const endTime = Date.now();
    const totalTime = endTime - metrics.startTime;
    
    const report = {
      module: moduleName,
      totalTimeMs: totalTime,
      totalTimeMinutes: Math.round(totalTime / 60000),
      operations: metrics.operations,
      optimizations: metrics.optimizations,
      errors: metrics.errors,
      efficiency: metrics.operations > 0 ? Math.round((metrics.optimizations / metrics.operations) * 100) : 0
    };
    
    console.log(`📊 Relatório de performance para ${moduleName}:`, report);
    return report;
  }

  /**
   * 📈 RELATÓRIO GLOBAL DE PERFORMANCE
   */
  getGlobalPerformanceReport() {
    const reports = [];
    const optimizerReports = [];
    
    // Relatórios de monitoramento
    for (const [moduleName, metrics] of this.performanceMetrics.entries()) {
      reports.push(this.stopPerformanceMonitoring(moduleName));
    }
    
    // Relatórios dos otimizadores
    for (const [moduleName, optimizer] of this.optimizers.entries()) {
      if (optimizer.getCompletePerformanceReport) {
        optimizerReports.push({
          module: moduleName,
          ...optimizer.getCompletePerformanceReport()
        });
      }
    }
    
    return {
      globalConfig: this.config,
      activeOptimizations: Array.from(this.activeOptimizations),
      moduleReports: reports.filter(r => r !== null),
      optimizerReports,
      summary: this.calculateGlobalSummary(reports, optimizerReports)
    };
  }

  calculateGlobalSummary(reports, optimizerReports) {
    const totalOperations = reports.reduce((sum, r) => sum + (r?.operations || 0), 0);
    const totalOptimizations = reports.reduce((sum, r) => sum + (r?.optimizations || 0), 0);
    const totalTimeSaved = optimizerReports.reduce((sum, r) => sum + (r?.optimizations?.timeSavedMs || 0), 0);
    
    return {
      totalOperations,
      totalOptimizations,
      totalTimeSavedMs: totalTimeSaved,
      totalTimeSavedMinutes: Math.round(totalTimeSaved / 60000),
      globalEfficiency: totalOperations > 0 ? Math.round((totalOptimizations / totalOperations) * 100) : 0,
      activeModules: this.optimizers.size
    };
  }

  /**
   * ⚙️ CONFIGURAÇÃO DINÂMICA
   */
  updateGlobalConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    // Atualizar otimizadores existentes
    for (const [moduleName, optimizer] of this.optimizers.entries()) {
      if (optimizer.updateOptimizationConfig) {
        const moduleConfig = this.config.moduleConfigs[moduleName] || {};
        optimizer.updateOptimizationConfig(moduleConfig);
      }
    }
    
    console.log('⚙️ Configuração global atualizada');
  }

  /**
   * 🧹 LIMPEZA DE RECURSOS
   */
  cleanup() {
    for (const optimizer of this.optimizers.values()) {
      if (optimizer.cleanup) {
        optimizer.cleanup();
      }
    }
    
    this.optimizers.clear();
    this.performanceMetrics.clear();
    this.activeOptimizations.clear();
    
    console.log('🧹 Speed Integration Manager limpo');
  }
}

module.exports = SpeedIntegrationManager;