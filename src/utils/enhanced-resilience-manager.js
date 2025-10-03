/**
 * Gerenciador de Resiliência Aprimorado
 * Sistema inteligente de recuperação de erros e manutenção de sessão
 */

class EnhancedResilienceManager {
  constructor(page, config = {}) {
    this.page = page;
    this.config = {
      maxRetries: 3,
      retryDelayMs: 500,
      sessionTimeoutMs: 30 * 60 * 1000, // 30 minutos
      healthCheckIntervalMs: 60000, // 1 minuto
      ...config
    };

    // Estado da sessão
    this.sessionState = {
      isActive: true,
      lastActivity: Date.now(),
      errorCount: 0,
      recoveryAttempts: 0,
      currentOperation: null
    };

    // Contadores de performance
    this.stats = {
      totalErrors: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      avgRecoveryTime: 0,
      lastRecoveryTime: 0
    };

    // Estratégias de recuperação priorizadas
    this.recoveryStrategies = [
      { name: 'refresh', priority: 1, timeoutMs: 5000 },
      { name: 'navigate_back', priority: 2, timeoutMs: 3000 },
      { name: 'close_modals', priority: 3, timeoutMs: 2000 },
      { name: 'clear_cache', priority: 4, timeoutMs: 1000 },
      { name: 'restart_session', priority: 5, timeoutMs: 10000 }
    ];

    // Iniciar monitoramento
    this.startHealthMonitoring();
  }

  /**
   * Executa operação com resiliência automática
   */
  async executeWithResilience(operation, operationName = 'unknown') {
    this.sessionState.currentOperation = operationName;
    this.sessionState.lastActivity = Date.now();

    let lastError = null;
    let attempt = 0;

    while (attempt < this.config.maxRetries) {
      try {
        const result = await operation();
        this.sessionState.errorCount = 0; // Reset contador de erro
        return result;

      } catch (error) {
        attempt++;
        lastError = error;
        this.sessionState.errorCount++;
        this.stats.totalErrors++;

        console.log(`⚠️ [RESILIENCE] Erro na tentativa ${attempt}/${this.config.maxRetries} para ${operationName}: ${error.message}`);

        if (attempt < this.config.maxRetries) {
          // Tentar recuperação baseada no tipo de erro
          const recovered = await this.attemptRecovery(error, operationName);

          if (recovered) {
            console.log(`✅ [RESILIENCE] Recuperação bem-sucedida para ${operationName}`);
            // Aguardar estabilização
            await this.page.waitForTimeout(this.config.retryDelayMs);
          } else {
            console.log(`❌ [RESILIENCE] Falha na recuperação para ${operationName}`);
            // Aguardar antes da próxima tentativa
            await this.page.waitForTimeout(this.config.retryDelayMs * attempt);
          }
        }
      }
    }

    this.sessionState.currentOperation = null;
    throw new Error(`Operação ${operationName} falhou após ${this.config.maxRetries} tentativas. Último erro: ${lastError?.message}`);
  }

  /**
   * Tenta recuperação baseada no tipo de erro
   */
  async attemptRecovery(error, operationName) {
    const recoveryStart = Date.now();
    this.sessionState.recoveryAttempts++;

    console.log(`🔧 [RESILIENCE] Iniciando recuperação para erro: ${error.message}`);

    try {
      // Determinar estratégia de recuperação baseada no erro
      const strategy = this.selectRecoveryStrategy(error);

      console.log(`🎯 [RESILIENCE] Usando estratégia: ${strategy.name}`);

      const success = await this.executeRecoveryStrategy(strategy, error, operationName);

      const recoveryTime = Date.now() - recoveryStart;
      this.stats.lastRecoveryTime = recoveryTime;
      this.stats.avgRecoveryTime = ((this.stats.avgRecoveryTime * this.stats.successfulRecoveries) + recoveryTime) / (this.stats.successfulRecoveries + 1);

      if (success) {
        this.stats.successfulRecoveries++;
        console.log(`✅ [RESILIENCE] Recuperação bem-sucedida em ${recoveryTime}ms`);
        return true;
      } else {
        this.stats.failedRecoveries++;
        console.log(`❌ [RESILIENCE] Falha na recuperação após ${recoveryTime}ms`);
        return false;
      }

    } catch (recoveryError) {
      this.stats.failedRecoveries++;
      console.log(`❌ [RESILIENCE] Erro durante recuperação: ${recoveryError.message}`);
      return false;
    }
  }

  /**
   * Seleciona estratégia de recuperação baseada no erro
   */
  selectRecoveryStrategy(error) {
    const errorMessage = error.message.toLowerCase();

    // Timeout ou elemento não encontrado
    if (errorMessage.includes('timeout') || errorMessage.includes('not found') || errorMessage.includes('waiting')) {
      return this.recoveryStrategies.find(s => s.name === 'refresh');
    }

    // Problemas de navegação
    if (errorMessage.includes('navigation') || errorMessage.includes('page') || errorMessage.includes('load')) {
      return this.recoveryStrategies.find(s => s.name === 'navigate_back');
    }

    // Modais ou elementos bloqueando
    if (errorMessage.includes('modal') || errorMessage.includes('dialog') || errorMessage.includes('overlay')) {
      return this.recoveryStrategies.find(s => s.name === 'close_modals');
    }

    // Problemas de sessão
    if (errorMessage.includes('session') || errorMessage.includes('connection') || errorMessage.includes('target')) {
      return this.recoveryStrategies.find(s => s.name === 'restart_session');
    }

    // Padrão: tentar refresh
    return this.recoveryStrategies.find(s => s.name === 'refresh');
  }

  /**
   * Executa estratégia de recuperação específica
   */
  async executeRecoveryStrategy(strategy, error, operationName) {
    try {
      switch (strategy.name) {
      case 'refresh':
        return await this.refreshPage();

      case 'navigate_back':
        return await this.navigateBack();

      case 'close_modals':
        return await this.closeAllModals();

      case 'clear_cache':
        return await this.clearBrowserCache();

      case 'restart_session':
        return await this.restartSession();

      default:
        console.log(`⚠️ [RESILIENCE] Estratégia desconhecida: ${strategy.name}`);
        return false;
      }
    } catch (strategyError) {
      console.log(`❌ [RESILIENCE] Erro executando estratégia ${strategy.name}: ${strategyError.message}`);
      return false;
    }
  }

  /**
   * Atualiza página mantendo contexto
   */
  async refreshPage() {
    try {
      console.log('🔄 [RESILIENCE] Atualizando página...');
      await this.page.reload({ waitUntil: 'domcontentloaded', timeout: 5000 });
      await this.page.waitForTimeout(1000);

      // Verificar se página carregou corretamente
      const bodyExists = await this.page.locator('body').isVisible({ timeout: 2000 });
      return bodyExists;

    } catch (e) {
      console.log(`❌ [RESILIENCE] Erro no refresh: ${e.message}`);
      return false;
    }
  }

  /**
   * Navega de volta e recarrega
   */
  async navigateBack() {
    try {
      console.log('⬅️ [RESILIENCE] Navegando de volta...');
      await this.page.goBack({ waitUntil: 'domcontentloaded', timeout: 3000 });
      await this.page.waitForTimeout(500);

      // Verificar se navegação funcionou
      const urlChanged = await this.page.url();
      return urlChanged && urlChanged.length > 0;

    } catch (e) {
      console.log(`❌ [RESILIENCE] Erro na navegação: ${e.message}`);
      return false;
    }
  }

  /**
   * Fecha todos os modais abertos
   */
  async closeAllModals() {
    try {
      console.log('🗙 [RESILIENCE] Fechando modais...');

      // Pressionar ESC múltiplas vezes
      for (let i = 0; i < 3; i++) {
        await this.page.keyboard.press('Escape');
        await this.page.waitForTimeout(100);
      }

      // Tentar fechar por botões
      const closeButtons = [
        'button:has-text("Fechar")',
        'button:has-text("Cancelar")',
        '.mat-dialog-close',
        '[aria-label*="close"]',
        '[aria-label*="fechar"]'
      ];

      for (const selector of closeButtons) {
        try {
          const buttons = await this.page.locator(selector).all();
          for (const button of buttons) {
            if (await button.isVisible({ timeout: 100 })) {
              await button.click();
              await this.page.waitForTimeout(50);
            }
          }
        } catch (e) {
          continue;
        }
      }

      // Verificar se modais foram fechados
      const modalsOpen = await this.page.locator('mat-dialog-container, [role="dialog"]').count();
      return modalsOpen === 0;

    } catch (e) {
      console.log(`❌ [RESILIENCE] Erro fechando modais: ${e.message}`);
      return false;
    }
  }

  /**
   * Limpa cache do navegador
   */
  async clearBrowserCache() {
    try {
      console.log('🧹 [RESILIENCE] Limpando cache...');

      // Limpar storage local e session
      await this.page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });

      return true;

    } catch (e) {
      console.log(`❌ [RESILIENCE] Erro limpando cache: ${e.message}`);
      return false;
    }
  }

  /**
   * Reinicia sessão (último recurso)
   */
  async restartSession() {
    try {
      console.log('🔄 [RESILIENCE] Reiniciando sessão...');

      // Recarregar página principal
      const currentUrl = this.page.url();
      const baseUrl = currentUrl.split('#')[0].split('?')[0];

      await this.page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await this.page.waitForTimeout(2000);

      // Verificar se sessão foi restaurada
      const pageLoaded = await this.page.locator('body').isVisible({ timeout: 3000 });
      if (pageLoaded) {
        this.sessionState.isActive = true;
        this.sessionState.lastActivity = Date.now();
        return true;
      }

      return false;

    } catch (e) {
      console.log(`❌ [RESILIENCE] Erro reiniciando sessão: ${e.message}`);
      return false;
    }
  }

  /**
   * Inicia monitoramento de saúde da sessão
   */
  startHealthMonitoring() {
    setInterval(async () => {
      await this.checkSessionHealth();
    }, this.config.healthCheckIntervalMs);
  }

  /**
   * Verifica saúde da sessão
   */
  async checkSessionHealth() {
    try {
      const now = Date.now();
      const timeSinceLastActivity = now - this.sessionState.lastActivity;

      // Verificar timeout de sessão
      if (timeSinceLastActivity > this.config.sessionTimeoutMs) {
        console.log('⚠️ [RESILIENCE] Sessão inativa detectada');
        this.sessionState.isActive = false;
      }

      // Verificar se página ainda responde
      const responsive = await this.page.locator('body').isVisible({ timeout: 1000 }).catch(() => false);
      if (!responsive) {
        console.log('⚠️ [RESILIENCE] Página não responsiva detectada');
        this.sessionState.isActive = false;
      }

      // Auto-recuperação se necessário
      if (!this.sessionState.isActive && this.sessionState.errorCount < 10) {
        console.log('🔧 [RESILIENCE] Iniciando auto-recuperação...');
        await this.attemptRecovery(new Error('Session health check failed'), 'health_check');
      }

    } catch (e) {
      console.log(`❌ [RESILIENCE] Erro no health check: ${e.message}`);
    }
  }

  /**
   * Marca atividade para resetar timeout
   */
  markActivity() {
    this.sessionState.lastActivity = Date.now();
    this.sessionState.isActive = true;
  }

  /**
   * Obtém estatísticas de resiliência
   */
  getStats() {
    return {
      ...this.stats,
      sessionState: { ...this.sessionState },
      recoverySuccessRate: this.stats.successfulRecoveries / (this.stats.successfulRecoveries + this.stats.failedRecoveries) || 0
    };
  }

  /**
   * Verifica se sessão está saudável
   */
  isSessionHealthy() {
    return this.sessionState.isActive && this.sessionState.errorCount < 5;
  }

  /**
   * Reset estatísticas
   */
  resetStats() {
    this.stats = {
      totalErrors: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      avgRecoveryTime: 0,
      lastRecoveryTime: 0
    };

    this.sessionState.errorCount = 0;
    this.sessionState.recoveryAttempts = 0;
  }
}

module.exports = EnhancedResilienceManager;