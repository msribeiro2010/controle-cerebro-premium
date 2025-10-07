/**
 * Ultra Speed Optimizer - Otimizações Avançadas para Automação PJE
 * 
 * Sistema de otimização inteligente que:
 * 1. Reduz delays baseado em contexto e histórico de sucesso
 * 2. Implementa cache agressivo de elementos DOM
 * 3. Detecta e contorna gargalos específicos do PJE
 * 4. Mantém estabilidade com fallback automático
 */

class UltraSpeedOptimizer {
  constructor() {
    // Histórico de sucessos para ajuste dinâmico
    this.successHistory = {
      navegacao: { successes: 0, failures: 0, avgTime: 0 },
      dropdown: { successes: 0, failures: 0, avgTime: 0 },
      modal: { successes: 0, failures: 0, avgTime: 0 },
      formulario: { successes: 0, failures: 0, avgTime: 0 }
    };

    // Cache de elementos DOM frequentemente usados
    this.domCache = new Map();
    this.domCacheTTL = 30000; // 30 segundos de cache
    
    // Configuração otimizada baseada em análise do PJE
    this.optimizedDelays = {
      // NAVEGAÇÃO - Delays mínimos com fallback
      navegacao: {
        carregarPagina: { min: 500, optimal: 800, max: 2000, current: 800 },
        aguardarElemento: { min: 100, optimal: 200, max: 1000, current: 200 },
        networkIdle: { min: 300, optimal: 500, max: 1500, current: 500 },
        domStable: { min: 50, optimal: 100, max: 500, current: 100 }
      },
      
      // INTERAÇÃO - Ultra rápido com detecção de erro
      interacao: {
        clicar: { min: 10, optimal: 20, max: 100, current: 20 },
        digitar: { min: 5, optimal: 10, max: 50, current: 10 },
        hover: { min: 5, optimal: 10, max: 50, current: 10 },
        scroll: { min: 10, optimal: 20, max: 100, current: 20 },
        aguardarResposta: { min: 100, optimal: 200, max: 1000, current: 200 }
      },
      
      // DROPDOWN/SELECT - Crítico para OJs
      dropdown: {
        abrir: { min: 100, optimal: 200, max: 800, current: 200 },
        carregarOpcoes: { min: 200, optimal: 400, max: 1500, current: 400 },
        filtrar: { min: 50, optimal: 100, max: 500, current: 100 },
        selecionar: { min: 100, optimal: 150, max: 500, current: 150 },
        fechar: { min: 50, optimal: 100, max: 300, current: 100 }
      },
      
      // MODAL - Delays específicos para modais do PJE
      modal: {
        abrir: { min: 200, optimal: 300, max: 1000, current: 300 },
        carregarConteudo: { min: 300, optimal: 500, max: 2000, current: 500 },
        fechar: { min: 100, optimal: 200, max: 500, current: 200 },
        overlay: { min: 50, optimal: 100, max: 300, current: 100 }
      },
      
      // FORMULÁRIO - Salvamento e validação
      formulario: {
        validacao: { min: 100, optimal: 200, max: 500, current: 200 },
        salvamento: { min: 500, optimal: 1000, max: 3000, current: 1000 },
        confirmacao: { min: 200, optimal: 300, max: 1000, current: 300 }
      }
    };

    // Estratégias de retry otimizadas
    this.retryStrategies = {
      immediate: { attempts: 1, delay: 0 },      // Sem delay entre tentativas
      fast: { attempts: 2, delay: 100 },         // 100ms entre tentativas
      normal: { attempts: 3, delay: 500 },       // 500ms entre tentativas
      critical: { attempts: 5, delay: 1000 }     // 1s entre tentativas (operações críticas)
    };

    // Detectores de padrões PJE
    this.pjePatterns = {
      loading: ['spinner', 'loading', 'aguarde', 'carregando', '.loader'],
      error: ['erro', 'falha', 'problema', 'exception', '.alert-danger'],
      success: ['sucesso', 'salvo', 'cadastrado', 'vinculado', '.alert-success'],
      modal: ['mat-dialog', '.modal', '[role="dialog"]', '.cdk-overlay'],
      dropdown: ['mat-select', 'mat-option', '.mat-select-panel', 'ng-dropdown']
    };

    // Contador de performance
    this.performanceMetrics = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      totalTime: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }

  /**
   * Obtém delay otimizado baseado no contexto e histórico
   */
  getOptimizedDelay(category, operation) {
    const config = this.optimizedDelays[category]?.[operation];
    if (!config) return 100; // Default fallback

    // Ajusta baseado no histórico de sucesso
    const history = this.successHistory[category];
    if (history.successes > 10) {
      // Se tem histórico de sucesso, pode ser mais agressivo
      const successRate = history.successes / (history.successes + history.failures);
      if (successRate > 0.95) {
        // 95%+ de sucesso: usar delay mínimo
        config.current = config.min;
      } else if (successRate > 0.8) {
        // 80-95% de sucesso: usar delay ótimo
        config.current = config.optimal;
      } else {
        // <80% de sucesso: aumentar delay para estabilidade
        config.current = Math.min(config.current * 1.2, config.max);
      }
    }

    return config.current;
  }

  /**
   * Cache inteligente de elementos DOM
   */
  async getCachedElement(page, selector, options = {}) {
    const cacheKey = `${selector}_${JSON.stringify(options)}`;
    const cached = this.domCache.get(cacheKey);

    // Verifica se o cache ainda é válido
    if (cached && Date.now() - cached.timestamp < this.domCacheTTL) {
      try {
        // Verifica se o elemento ainda existe
        const stillExists = await cached.element.evaluate(el => document.contains(el));
        if (stillExists) {
          this.performanceMetrics.cacheHits++;
          return cached.element;
        }
      } catch {
        // Elemento não existe mais, limpar cache
        this.domCache.delete(cacheKey);
      }
    }

    // Cache miss - buscar elemento
    this.performanceMetrics.cacheMisses++;
    const element = await page.$(selector);
    
    if (element) {
      this.domCache.set(cacheKey, {
        element,
        timestamp: Date.now()
      });
    }

    return element;
  }

  /**
   * Espera inteligente por elemento com cache
   */
  async waitForElementOptimized(page, selector, options = {}) {
    const startTime = Date.now();
    const timeout = options.timeout || this.getOptimizedDelay('navegacao', 'aguardarElemento');
    
    // Primeiro tenta cache
    let element = await this.getCachedElement(page, selector);
    if (element) return element;

    // Se não está no cache, espera aparecer
    try {
      element = await page.waitForSelector(selector, {
        timeout,
        state: options.state || 'visible'
      });
      
      // Adiciona ao cache
      this.domCache.set(selector, {
        element,
        timestamp: Date.now()
      });
      
      // Registra sucesso
      this.recordSuccess('navegacao', Date.now() - startTime);
      
      return element;
    } catch (error) {
      this.recordFailure('navegacao');
      throw error;
    }
  }

  /**
   * Clique otimizado com retry inteligente
   */
  async clickOptimized(page, selector, options = {}) {
    const strategy = options.critical ? this.retryStrategies.critical : this.retryStrategies.fast;
    let lastError;

    for (let attempt = 0; attempt < strategy.attempts; attempt++) {
      try {
        // Tenta diferentes métodos de clique
        const element = await this.waitForElementOptimized(page, selector, { timeout: 2000 });
        
        if (!element) throw new Error(`Elemento não encontrado: ${selector}`);

        // Método 1: Clique normal
        try {
          await element.click({ delay: this.getOptimizedDelay('interacao', 'clicar') });
          this.recordSuccess('interacao', 20);
          return true;
        } catch {
          // Método 2: Clique via JavaScript
          await page.evaluate(sel => {
            const el = document.querySelector(sel);
            if (el) el.click();
          }, selector);
          this.recordSuccess('interacao', 30);
          return true;
        }
      } catch (error) {
        lastError = error;
        if (attempt < strategy.attempts - 1) {
          await page.waitForTimeout(strategy.delay);
        }
      }
    }

    this.recordFailure('interacao');
    throw lastError;
  }

  /**
   * Seleção otimizada de dropdown (crítico para OJs)
   */
  async selectDropdownOptimized(page, dropdownSelector, optionText, options = {}) {
    const startTime = Date.now();

    try {
      // 1. Abrir dropdown com delay otimizado
      await this.clickOptimized(page, dropdownSelector);
      await page.waitForTimeout(this.getOptimizedDelay('dropdown', 'abrir'));

      // 2. Aguardar opções carregarem (com cache de seletores)
      const optionSelectors = [
        'mat-option',
        '[role="option"]',
        '.mat-option',
        '.dropdown-item',
        'li[role="option"]'
      ];

      let optionsFound = false;
      for (const selector of optionSelectors) {
        const options = await page.$$(selector);
        if (options.length > 0) {
          optionsFound = true;
          break;
        }
      }

      if (!optionsFound) {
        throw new Error('Nenhuma opção encontrada no dropdown');
      }

      await page.waitForTimeout(this.getOptimizedDelay('dropdown', 'carregarOpcoes'));

      // 3. Filtrar/digitar se houver campo de busca (otimizado)
      const searchInput = await page.$('input[type="text"]:focus, input[type="search"]:focus');
      if (searchInput) {
        await searchInput.type(optionText, { 
          delay: this.getOptimizedDelay('interacao', 'digitar') 
        });
        await page.waitForTimeout(this.getOptimizedDelay('dropdown', 'filtrar'));
      }

      // 4. Selecionar opção com múltiplas estratégias
      const optionSelected = await this.selectOptionByMultipleStrategies(page, optionText);
      
      if (!optionSelected) {
        throw new Error(`Opção não encontrada: ${optionText}`);
      }

      // 5. Aguardar fechamento do dropdown
      await page.waitForTimeout(this.getOptimizedDelay('dropdown', 'fechar'));
      
      this.recordSuccess('dropdown', Date.now() - startTime);
      return true;

    } catch (error) {
      this.recordFailure('dropdown');
      throw error;
    }
  }

  /**
   * Múltiplas estratégias para selecionar opção
   */
  async selectOptionByMultipleStrategies(page, optionText) {
    // Estratégia 1: Texto exato
    let option = await page.$(`mat-option:has-text("${optionText}")`);
    if (option) {
      await option.click();
      return true;
    }

    // Estratégia 2: Texto parcial
    option = await page.evaluate(text => {
      const options = Array.from(document.querySelectorAll('mat-option, [role="option"]'));
      const found = options.find(opt => opt.textContent.includes(text));
      if (found) {
        found.click();
        return true;
      }
      return false;
    }, optionText);

    if (option) return true;

    // Estratégia 3: Texto normalizado
    return await page.evaluate(text => {
      const normalize = str => str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const normalizedSearch = normalize(text);
      const options = Array.from(document.querySelectorAll('mat-option, [role="option"]'));
      const found = options.find(opt => normalize(opt.textContent).includes(normalizedSearch));
      if (found) {
        found.click();
        return true;
      }
      return false;
    }, optionText);
  }

  /**
   * Detecção inteligente de loading/spinner
   */
  async waitForLoadingComplete(page, options = {}) {
    const timeout = options.timeout || 5000;
    const startTime = Date.now();

    // Detecta e aguarda desaparecer todos os indicadores de loading
    for (const pattern of this.pjePatterns.loading) {
      try {
        await page.waitForSelector(pattern, { 
          state: 'hidden', 
          timeout: Math.min(1000, timeout - (Date.now() - startTime)) 
        });
      } catch {
        // Ignora se não encontrar o padrão
      }
    }

    // Aguarda um delay mínimo para garantir estabilidade
    await page.waitForTimeout(this.getOptimizedDelay('navegacao', 'domStable'));
  }

  /**
   * Registra sucesso de operação
   */
  recordSuccess(category, timeMs) {
    const history = this.successHistory[category];
    history.successes++;
    history.avgTime = (history.avgTime * (history.successes - 1) + timeMs) / history.successes;
    
    this.performanceMetrics.totalOperations++;
    this.performanceMetrics.successfulOperations++;
    this.performanceMetrics.totalTime += timeMs;
  }

  /**
   * Registra falha de operação
   */
  recordFailure(category) {
    this.successHistory[category].failures++;
    this.performanceMetrics.totalOperations++;
    this.performanceMetrics.failedOperations++;
  }

  /**
   * Limpa cache antigo
   */
  cleanCache() {
    const now = Date.now();
    for (const [key, value] of this.domCache.entries()) {
      if (now - value.timestamp > this.domCacheTTL) {
        this.domCache.delete(key);
      }
    }
  }

  /**
   * Relatório de performance
   */
  getPerformanceReport() {
    const successRate = this.performanceMetrics.successfulOperations / 
                       this.performanceMetrics.totalOperations * 100;
    const avgTime = this.performanceMetrics.totalTime / 
                   this.performanceMetrics.totalOperations;
    const cacheHitRate = this.performanceMetrics.cacheHits / 
                        (this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses) * 100;

    return {
      totalOperations: this.performanceMetrics.totalOperations,
      successRate: successRate.toFixed(2) + '%',
      avgOperationTime: avgTime.toFixed(0) + 'ms',
      cacheHitRate: cacheHitRate.toFixed(2) + '%',
      categories: Object.entries(this.successHistory).map(([cat, data]) => ({
        category: cat,
        successes: data.successes,
        failures: data.failures,
        successRate: ((data.successes / (data.successes + data.failures)) * 100).toFixed(2) + '%',
        avgTime: data.avgTime.toFixed(0) + 'ms'
      }))
    };
  }

  /**
   * Auto-ajuste baseado em performance
   */
  autoAdjust() {
    // Se taxa de sucesso geral < 70%, aumenta todos os delays
    const successRate = this.performanceMetrics.successfulOperations / 
                       this.performanceMetrics.totalOperations;
    
    if (successRate < 0.7) {
      console.log('⚠️ Taxa de sucesso baixa, aumentando delays para estabilidade');
      this.increaseAllDelays(1.5); // Aumenta 50%
    } else if (successRate > 0.95) {
      console.log('✅ Taxa de sucesso alta, reduzindo delays para maior velocidade');
      this.decreaseAllDelays(0.8); // Reduz 20%
    }
  }

  /**
   * Aumenta todos os delays
   */
  increaseAllDelays(factor) {
    for (const category of Object.values(this.optimizedDelays)) {
      for (const config of Object.values(category)) {
        config.current = Math.min(config.current * factor, config.max);
      }
    }
  }

  /**
   * Diminui todos os delays
   */
  decreaseAllDelays(factor) {
    for (const category of Object.values(this.optimizedDelays)) {
      for (const config of Object.values(category)) {
        config.current = Math.max(config.current * factor, config.min);
      }
    }
  }
}

module.exports = UltraSpeedOptimizer;