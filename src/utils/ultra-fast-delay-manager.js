/**
 * ⚡ ULTRA FAST DELAY MANAGER
 * Sistema de delays otimizado com tempos ultra-rápidos para operações críticas
 * Implementa delays adaptativos baseados no contexto e performance
 */

class UltraFastDelayManager {
  constructor(options = {}) {
    this.config = {
      // Modo de operação
      mode: options.mode || 'ultra_fast', // ultra_fast, fast, normal, safe
            
      // Delays base (em milissegundos) - ULTRA OTIMIZADO
      delays: {
        ultra_fast: {
          click: 30,           // Reduzido de 50 - cliques ainda mais rápidos
          type: 15,            // Reduzido de 25 - digitação instantânea
          navigation: 80,      // Reduzido de 100 - navegação mínima
          search: 120,         // Reduzido de 150 - busca otimizada
          form_fill: 20,       // Reduzido de 30 - preenchimento instantâneo
          page_load: 400,      // Reduzido de 500 - carregamento básico
          element_wait: 150,   // Reduzido de 200 - espera por elementos
          network: 250,        // Reduzido de 300 - requisições de rede
          critical: 5,         // Reduzido de 10 - operações críticas
          batch: 3             // Reduzido de 5 - processamento em lote
        },
        fast: {
          click: 80,           // Reduzido de 100
          type: 40,            // Reduzido de 50
          navigation: 150,     // Reduzido de 200
          search: 250,         // Reduzido de 300
          form_fill: 60,       // Reduzido de 75
          page_load: 800,      // Reduzido de 1000
          element_wait: 300,   // Reduzido de 400
          network: 500,        // Reduzido de 600
          critical: 20,        // Reduzido de 25
          batch: 10            // Reduzido de 15
        },
        normal: {
          click: 200,          // Reduzido de 250
          type: 80,            // Reduzido de 100
          navigation: 400,     // Reduzido de 500
          search: 600,         // Reduzido de 750
          form_fill: 120,      // Reduzido de 150
          page_load: 1500,     // Reduzido de 2000
          element_wait: 600,   // Reduzido de 800
          network: 1000,       // Reduzido de 1200
          critical: 40,        // Reduzido de 50
          batch: 25            // Reduzido de 30
        },
        safe: {
          click: 400,          // Reduzido de 500
          type: 150,           // Reduzido de 200
          navigation: 800,     // Reduzido de 1000
          search: 1200,        // Reduzido de 1500
          form_fill: 250,      // Reduzido de 300
          page_load: 2500,     // Reduzido de 3000
          element_wait: 1200,  // Reduzido de 1500
          network: 1600,       // Reduzido de 2000
          critical: 80,        // Reduzido de 100
          batch: 60            // Reduzido de 75
        }
      },
            
      // Configurações adaptativas - OTIMIZADAS
      adaptive: {
        enabled: options.adaptive !== false,
        performanceThreshold: 0.85, // Aumentado de 0.8 para 85% de sucesso
        errorThreshold: 0.08,        // Reduzido de 0.1 para 8% de erro
        adjustmentFactor: 0.75,      // Reduzido de 0.8 - ajuste mais agressivo (25% mais rápido/lento)
        minDelay: 3,                 // Reduzido de 5 - delay mínimo absoluto
        maxDelay: 4000               // Reduzido de 5000 - delay máximo absoluto
      },
            
      // Configurações de contexto
      context: {
        detectSlowElements: true,
        detectSlowNetwork: true,
        adaptToPageComplexity: true,
        useElementVisibility: true
      }
    };
        
    // Estatísticas de performance
    this.stats = {
      operations: 0,
      successes: 0,
      errors: 0,
      totalTime: 0,
      avgDelay: 0,
      adaptations: 0
    };
        
    // Cache de delays adaptativos
    this.adaptiveDelays = new Map();
        
    // Histórico de performance por operação
    this.performanceHistory = new Map();
        
    console.log(`⚡ [DELAY] Inicializado em modo: ${this.config.mode}`);
  }

  /**
     * ⚡ DELAY PRINCIPAL (MÉTODO MAIS USADO)
     */
  async delay(type, context = {}) {
    const startTime = Date.now();
        
    try {
      // Calcular delay otimizado
      const delayTime = this.calculateOptimalDelay(type, context);
            
      // Log apenas para delays significativos
      if (delayTime > 100) {
        console.log(`⏱️ [DELAY] ${type}: ${delayTime}ms`);
      }
            
      // Executar delay
      if (delayTime > 0) {
        await this.sleep(delayTime);
      }
            
      // Registrar sucesso
      this.recordOperation(type, delayTime, true, Date.now() - startTime);
            
    } catch (error) {
      this.recordOperation(type, 0, false, Date.now() - startTime);
      throw error;
    }
  }

  /**
     * 🚀 DELAYS ESPECÍFICOS ULTRA-OTIMIZADOS
     */
    
  // Clique ultra-rápido
  async clickDelay(context = {}) {
    return await this.delay('click', context);
  }
    
  // Digitação ultra-rápida
  async typeDelay(context = {}) {
    return await this.delay('type', context);
  }
    
  // Navegação otimizada
  async navigationDelay(context = {}) {
    return await this.delay('navigation', context);
  }
    
  // Busca rápida
  async searchDelay(context = {}) {
    return await this.delay('search', context);
  }
    
  // Preenchimento de formulário
  async formFillDelay(context = {}) {
    return await this.delay('form_fill', context);
  }
    
  // Carregamento de página
  async pageLoadDelay(context = {}) {
    return await this.delay('page_load', context);
  }
    
  // Espera por elemento
  async elementWaitDelay(context = {}) {
    return await this.delay('element_wait', context);
  }
    
  // Requisição de rede
  async networkDelay(context = {}) {
    return await this.delay('network', context);
  }
    
  // Operação crítica (mínimo absoluto)
  async criticalDelay(context = {}) {
    return await this.delay('critical', context);
  }
    
  // Processamento em lote
  async batchDelay(context = {}) {
    return await this.delay('batch', context);
  }

  /**
     * 🎯 MÉTODO WAIT GENÉRICO (ALIAS PARA DELAY)
     * Método de conveniência para compatibilidade
     */
  async wait(type, context = {}) {
    return await this.delay(type, context);
  }

  /**
     * 🧠 CALCULAR DELAY OTIMIZADO
     */
  calculateOptimalDelay(type, context) {
    // Obter delay base
    let baseDelay = this.getBaseDelay(type);
        
    // Aplicar adaptações
    if (this.config.adaptive.enabled) {
      baseDelay = this.applyAdaptiveAdjustments(type, baseDelay, context);
    }
        
    // Aplicar ajustes contextuais
    baseDelay = this.applyContextualAdjustments(baseDelay, context);
        
    // Garantir limites
    return Math.max(
      this.config.adaptive.minDelay,
      Math.min(baseDelay, this.config.adaptive.maxDelay)
    );
  }

  /**
     * 📊 OBTER DELAY BASE
     */
  getBaseDelay(type) {
    const modeDelays = this.config.delays[this.config.mode];
    return modeDelays[type] || modeDelays.critical;
  }

  /**
     * 🔄 APLICAR AJUSTES ADAPTATIVOS
     */
  applyAdaptiveAdjustments(type, baseDelay, context) {
    const history = this.performanceHistory.get(type);
        
    if (!history || history.length < 5) {
      return baseDelay; // Não há dados suficientes
    }
        
    // Calcular taxa de sucesso recente
    const recentHistory = history.slice(-10); // Últimas 10 operações
    const successRate = recentHistory.filter(h => h.success).length / recentHistory.length;
    const avgTime = recentHistory.reduce((sum, h) => sum + h.totalTime, 0) / recentHistory.length;
        
    let adjustedDelay = baseDelay;
        
    // Se taxa de sucesso é alta e tempo é baixo, acelerar
    if (successRate >= this.config.adaptive.performanceThreshold && avgTime < baseDelay * 2) {
      adjustedDelay = Math.round(baseDelay * this.config.adaptive.adjustmentFactor);
      this.stats.adaptations++;
      console.log(`🚀 [DELAY] Acelerando ${type}: ${baseDelay}ms → ${adjustedDelay}ms`);
    }
    // Se taxa de erro é alta, desacelerar
    else if (successRate < (1 - this.config.adaptive.errorThreshold)) {
      adjustedDelay = Math.round(baseDelay / this.config.adaptive.adjustmentFactor);
      this.stats.adaptations++;
      console.log(`🐌 [DELAY] Desacelerando ${type}: ${baseDelay}ms → ${adjustedDelay}ms`);
    }
        
    // Cache do delay adaptativo
    this.adaptiveDelays.set(type, adjustedDelay);
        
    return adjustedDelay;
  }

  /**
     * 🎯 APLICAR AJUSTES CONTEXTUAIS
     */
  applyContextualAdjustments(baseDelay, context) {
    let adjustedDelay = baseDelay;
        
    // Ajuste por complexidade da página
    if (context.pageComplexity) {
      if (context.pageComplexity === 'high') {
        adjustedDelay *= 1.2;
      } else if (context.pageComplexity === 'low') {
        adjustedDelay *= 0.8;
      }
    }
        
    // Ajuste por velocidade da rede
    if (context.networkSpeed) {
      if (context.networkSpeed === 'slow') {
        adjustedDelay *= 1.3;
      } else if (context.networkSpeed === 'fast') {
        adjustedDelay *= 0.7;
      }
    }
        
    // Ajuste por visibilidade do elemento
    if (context.elementVisible === false) {
      adjustedDelay *= 1.5; // Esperar mais se elemento não está visível
    }
        
    // Ajuste por prioridade
    if (context.priority) {
      if (context.priority === 'critical') {
        adjustedDelay *= 0.5; // Crítico = mais rápido
      } else if (context.priority === 'low') {
        adjustedDelay *= 1.2; // Baixa prioridade = mais lento
      }
    }
        
    // Ajuste por tentativa (retry)
    if (context.attempt && context.attempt > 1) {
      adjustedDelay *= (1 + (context.attempt - 1) * 0.2); // Aumentar delay a cada tentativa
    }
        
    return Math.round(adjustedDelay);
  }

  /**
     * 😴 SLEEP OTIMIZADO
     */
  async sleep(ms) {
    if (ms <= 0) return;
        
    return new Promise(resolve => {
      setTimeout(resolve, ms);
    });
  }

  /**
     * 📊 REGISTRAR OPERAÇÃO
     */
  recordOperation(type, delayUsed, success, totalTime) {
    // Estatísticas gerais
    this.stats.operations++;
    if (success) this.stats.successes++;
    else this.stats.errors++;
    this.stats.totalTime += totalTime;
    this.stats.avgDelay = this.stats.totalTime / this.stats.operations;
        
    // Histórico por tipo
    if (!this.performanceHistory.has(type)) {
      this.performanceHistory.set(type, []);
    }
        
    const history = this.performanceHistory.get(type);
    history.push({
      timestamp: Date.now(),
      delayUsed,
      success,
      totalTime
    });
        
    // Manter apenas últimas 50 operações por tipo
    if (history.length > 50) {
      history.shift();
    }
  }

  /**
     * 🔧 CONFIGURAR MODO
     */
  setMode(mode) {
    if (!this.config.delays[mode]) {
      throw new Error(`Modo inválido: ${mode}`);
    }
        
    this.config.mode = mode;
    this.adaptiveDelays.clear(); // Limpar cache adaptativo
    console.log(`🔧 [DELAY] Modo alterado para: ${mode}`);
  }

  /**
     * ⚡ MODO TURBO (ULTRA RÁPIDO)
     */
  enableTurboMode() {
    this.setMode('ultra_fast');
    this.config.adaptive.adjustmentFactor = 0.7; // Mais agressivo
    console.log('🚀 [DELAY] MODO TURBO ATIVADO!');
  }

  /**
     * 🛡️ MODO SEGURO
     */
  enableSafeMode() {
    this.setMode('safe');
    this.config.adaptive.adjustmentFactor = 1.2; // Mais conservador
    console.log('🛡️ [DELAY] MODO SEGURO ATIVADO!');
  }

  /**
     * 🎯 DELAYS ESPECÍFICOS PARA OJ
     */
  async ojSearchDelay() {
    return await this.delay('search', { priority: 'critical', context: 'oj_search' });
  }
    
  async ojClickDelay() {
    return await this.delay('click', { priority: 'critical', context: 'oj_click' });
  }
    
  async ojFormDelay() {
    return await this.delay('form_fill', { priority: 'critical', context: 'oj_form' });
  }
    
  async ojNavigationDelay() {
    return await this.delay('navigation', { priority: 'critical', context: 'oj_navigation' });
  }

  /**
     * 📊 OBTER ESTATÍSTICAS
     */
  getStats() {
    const successRate = this.stats.operations > 0 ? 
      Math.round((this.stats.successes / this.stats.operations) * 100) : 0;
        
    return {
      ...this.stats,
      successRate,
      mode: this.config.mode,
      adaptiveEnabled: this.config.adaptive.enabled,
      avgDelayMs: Math.round(this.stats.avgDelay)
    };
  }

  /**
     * 📈 RELATÓRIO DE PERFORMANCE
     */
  generatePerformanceReport() {
    const stats = this.getStats();
        
    console.log('\n📈 ========== RELATÓRIO DE PERFORMANCE - DELAYS ==========');
    console.log(`⚡ Modo atual: ${stats.mode.toUpperCase()}`);
    console.log(`📊 Operações totais: ${stats.operations}`);
    console.log(`✅ Taxa de sucesso: ${stats.successRate}%`);
    console.log(`⏱️ Delay médio: ${stats.avgDelayMs}ms`);
    console.log(`🔄 Adaptações realizadas: ${stats.adaptations}`);
    console.log(`⏰ Tempo total: ${Math.round(stats.totalTime / 1000)}s`);
        
    // Performance por tipo
    console.log('\n📋 PERFORMANCE POR TIPO:');
    for (const [type, history] of this.performanceHistory.entries()) {
      if (history.length > 0) {
        const typeSuccessRate = Math.round(
          (history.filter(h => h.success).length / history.length) * 100
        );
        const avgDelay = Math.round(
          history.reduce((sum, h) => sum + h.delayUsed, 0) / history.length
        );
        console.log(`  ${type}: ${typeSuccessRate}% sucesso, ${avgDelay}ms delay médio`);
      }
    }
        
    // Recomendações
    console.log('\n💡 RECOMENDAÇÕES:');
    if (stats.successRate > 95) {
      console.log('  🚀 Performance excelente! Considere modo mais rápido.');
    } else if (stats.successRate < 80) {
      console.log('  🐌 Performance baixa. Considere modo mais lento.');
    } else {
      console.log('  ✅ Performance adequada. Modo atual é ideal.');
    }
        
    return stats;
  }

  /**
     * 🔄 RESETAR ESTATÍSTICAS
     */
  resetStats() {
    this.stats = {
      operations: 0,
      successes: 0,
      errors: 0,
      totalTime: 0,
      avgDelay: 0,
      adaptations: 0
    };
    this.performanceHistory.clear();
    this.adaptiveDelays.clear();
    console.log('🔄 [DELAY] Estatísticas resetadas');
  }

  /**
     * 🎛️ CONFIGURAÇÃO PERSONALIZADA
     */
  customizeDelays(customDelays) {
    this.config.delays.custom = { ...this.config.delays.ultra_fast, ...customDelays };
    this.setMode('custom');
    console.log('🎛️ [DELAY] Delays personalizados aplicados');
  }

  /**
     * 🔍 DETECTAR CONTEXTO AUTOMATICAMENTE
     */
  async detectContext(page) {
    const context = {};
        
    try {
      // Detectar complexidade da página
      const elementCount = await page.$$eval('*', elements => elements.length);
      if (elementCount > 1000) context.pageComplexity = 'high';
      else if (elementCount < 100) context.pageComplexity = 'low';
      else context.pageComplexity = 'medium';
            
      // Detectar velocidade da rede (simulado)
      const startTime = Date.now();
      await page.evaluate(() => fetch('/favicon.ico').catch(() => {}));
      const networkTime = Date.now() - startTime;
            
      if (networkTime > 1000) context.networkSpeed = 'slow';
      else if (networkTime < 200) context.networkSpeed = 'fast';
      else context.networkSpeed = 'medium';
            
    } catch (error) {
      // Contexto padrão em caso de erro
      context.pageComplexity = 'medium';
      context.networkSpeed = 'medium';
    }
        
    return context;
  }
}

module.exports = UltraFastDelayManager;